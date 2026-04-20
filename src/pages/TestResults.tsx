import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../lib/notifications';
import { formatDate, formatDateTime } from '../lib/dateFormat';
import { getCurrentDateTime } from '../lib/timezone';
import { FlaskConical, Search, Filter, CheckCircle, Clock, AlertCircle, Eye, Bell, MessageSquare } from 'lucide-react';
import Pagination from '../components/Pagination';

interface VisitTest {
  id: string;
  visit_id: string;
  test_id: string;
  results_status: 'pending' | 'in_progress' | 'completed';
  results_entered_at: string | null;
  sent_to_doctor_at: string | null;
  sms_sent_at: string | null;
  doctor_viewed_at: string | null;
  created_at: string;
  visit: {
    id: string;
    created_at: string;
    patient: {
      id: string;
      name: string;
      phone: string | null;
    };
  };
  test: {
    name: string;
  };
}

interface TestResultsProps {
  onViewResults?: (visitTestId: string) => void;
}

export default function TestResults({ onViewResults }: TestResultsProps) {
  const { user, profile } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const [visitTests, setVisitTests] = useState<VisitTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, in_progress: 0, completed: 0, new: 0 });
  const [sendingSmsFor, setSendingSmsFor] = useState<string | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    loadVisitTests();
    loadStatusCounts();

    const channel = supabase
      .channel('visit_tests_changes_doctor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visit_tests'
        },
        () => {
          loadVisitTests();
          loadStatusCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadVisitTests();
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadStatusCounts = async () => {
    const [pendingRes, inProgressRes, completedRes, newRes] = await Promise.all([
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).eq('results_status', 'pending'),
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).eq('results_status', 'in_progress'),
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).eq('results_status', 'completed'),
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).not('sent_to_doctor_at', 'is', null).is('doctor_viewed_at', null),
    ]);
    setStatusCounts({
      pending: pendingRes.count || 0,
      in_progress: inProgressRes.count || 0,
      completed: completedRes.count || 0,
      new: newRes.count || 0,
    });
  };

  const loadVisitTests = async () => {
    if (!user) return;

    try {
      const offset = (currentPage - 1) * itemsPerPage;

      const { data, error } = await supabase.rpc('search_visit_tests', {
        search_term: searchTerm,
        status_filter: statusFilter,
        page_offset: offset,
        page_limit: itemsPerPage,
      });

      if (error) throw error;

      const rows = (data as any[]) || [];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      const results: VisitTest[] = rows.map((row: any) => ({
        id: row.id,
        visit_id: row.visit_id,
        test_id: row.test_id,
        results_status: row.results_status,
        results_entered_at: row.results_entered_at,
        sent_to_doctor_at: row.sent_to_doctor_at,
        sms_sent_at: row.sms_sent_at,
        doctor_viewed_at: row.doctor_viewed_at,
        created_at: row.created_at,
        visit: {
          id: row.visit_id,
          created_at: row.visit_created_at,
          patient: {
            id: row.patient_id,
            name: row.patient_name,
            phone: row.patient_phone,
          },
        },
        test: {
          name: row.test_name,
        },
      }));

      setVisitTests(results);
      setTotalItems(totalCount);
    } catch (error) {
      console.error('Error loading test results:', error);
      alert('Failed to load test results');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async (visitTestId: string) => {
    const { error } = await supabase
      .from('visit_tests')
      .update({ doctor_viewed_at: getCurrentDateTime() })
      .eq('id', visitTestId);

    if (error) {
      console.error('Error marking as viewed:', error);
    }

    const notification = notifications.find(n => n.related_visit_test_id === visitTestId && !n.is_read);
    if (notification) {
      await markAsRead(notification.id);
    }

    if (onViewResults) {
      onViewResults(visitTestId);
    }

    await loadVisitTests();
  };

  const handleSendSMS = async (visitTest: VisitTest) => {
    if (!profile || profile.role !== 'doctor') {
      alert('Only doctors can send SMS');
      return;
    }

    if (!visitTest.visit.patient.phone) {
      alert('Patient has no phone number');
      return;
    }

    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['sms_completion_message']);

      const settingsMap: Record<string, string> = {};
      if (settings) {
        settings.forEach((s: any) => {
          settingsMap[s.key] = s.value;
        });
      }

      const messageTemplate = settingsMap.sms_completion_message || 'Hello {patient_name}, your test results are ready. Please visit the clinic.';
      const previewMessage = messageTemplate.replace(/{patient_name}/g, visitTest.visit.patient.name);

      const confirmSend = confirm(
        `Send SMS to ${visitTest.visit.patient.name}?\n\nPhone: ${visitTest.visit.patient.phone}\n\nMessage: "${previewMessage}"`
      );
      if (!confirmSend) return;

      setSendingSmsFor(visitTest.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-lab-result-sms`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visit_test_id: visitTest.id,
          recipient_type: 'patient',
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        const text = await response.text();
        console.error('Raw response:', text);
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }

      console.log('SMS Response:', { status: response.status, result });

      if (!response.ok || !result.success) {
        const errorMsg = result.error || result.message || 'Failed to send SMS';
        console.error('SMS API Error:', errorMsg);
        throw new Error(errorMsg);
      }

      alert('SMS sent successfully!');
      await loadVisitTests();
    } catch (error: any) {
      console.error('Error sending SMS (full):', error);
      const errorMessage = error.message || 'Unknown error';
      console.error('Error message:', errorMessage);
      alert(`Failed to send SMS: ${errorMessage}`);
    } finally {
      setSendingSmsFor(null);
    }
  };

  const paginatedTests = visitTests;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = statusCounts.pending;
  const inProgressCount = statusCounts.in_progress;
  const completedCount = statusCounts.completed;
  const newResultsCount = statusCounts.new;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Results</h1>
          <p className="mt-1 text-sm text-gray-500">
            View laboratory test results for your patients
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-lg font-semibold text-gray-900">{pendingCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">In Progress</dt>
                  <dd className="text-lg font-semibold text-gray-900">{inProgressCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                  <dd className="text-lg font-semibold text-gray-900">{completedCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search by patient, visit number, or test name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Ordered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Results Available
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SMS Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No test results found
                  </td>
                </tr>
              ) : (
                paginatedTests.map((vt) => {
                  const isNew = vt.sent_to_doctor_at && !vt.doctor_viewed_at;
                  return (
                    <tr key={vt.id} className={`hover:bg-gray-50 ${isNew ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {vt.visit.patient.name}
                          </div>
                          {isNew && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">ID: {vt.visit.patient.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">#{vt.visit.id.slice(0, 8)}</div>
                        <div className="text-sm text-gray-500">
                          {formatDateTime(vt.visit.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{vt.test.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(vt.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(vt.results_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {vt.sent_to_doctor_at ? (
                          <div className="text-xs text-gray-500">
                            {formatDate(vt.sent_to_doctor_at)}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Not yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {vt.sms_sent_at ? (
                          <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <MessageSquare className="w-3 h-3 mr-1" />
                              SMS Sent
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDateTime(vt.sms_sent_at)}
                            </div>
                          </div>
                        ) : vt.results_status === 'completed' && vt.sent_to_doctor_at && vt.visit.patient.phone ? (
                          <button
                            onClick={() => handleSendSMS(vt)}
                            disabled={sendingSmsFor === vt.id}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            title="Send SMS to patient"
                          >
                            <MessageSquare className="w-3 h-3 mr-1" />
                            {sendingSmsFor === vt.id ? 'Sending...' : 'Send SMS'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {vt.results_status === 'completed' && vt.sent_to_doctor_at ? (
                          <button
                            onClick={() => handleViewResults(vt.id)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Results
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {vt.results_status === 'completed' ? 'Not sent yet' : 'Awaiting results'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
