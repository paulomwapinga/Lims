import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateTime } from '../lib/dateFormat';
import { getCurrentDateTime } from '../lib/timezone';
import { FlaskConical, Search, Filter, CheckCircle, Clock, AlertCircle, Eye, CreditCard as Edit, Send, Trash2, MessageSquare, FileText, Stethoscope, X } from 'lucide-react';
import Pagination from '../components/Pagination';

interface VisitTest {
  id: string;
  visit_id: string;
  test_id: string;
  results_status: 'pending' | 'in_progress' | 'completed';
  results_entered_at: string | null;
  technician_notes: string | null;
  sent_to_doctor_at: string | null;
  sms_sent_at: string | null;
  created_at: string;
  visit: {
    id: string;
    created_at: string;
    doctor_id: string;
    notes: string | null;
    diagnosis: string | null;
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

interface LabResultsProps {
  onEnterResults?: (visitTestId: string) => void;
  onViewResults?: (visitTestId: string) => void;
  refreshTrigger?: number;
}

export default function LabResults({ onEnterResults, onViewResults, refreshTrigger }: LabResultsProps) {
  const { profile } = useAuth();
  const [visitTests, setVisitTests] = useState<VisitTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, in_progress: 0, completed: 0 });
  const [sendingSmsFor, setSendingSmsFor] = useState<string | null>(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState('');
  const itemsPerPage = 20;

  useEffect(() => {
    loadVisitTests();
    loadStatusCounts();

    const channel = supabase
      .channel('visit_tests_changes')
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
  }, []);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadVisitTests();
      loadStatusCounts();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadVisitTests();
  }, [currentPage, searchTerm, statusFilter]);

  const loadStatusCounts = async () => {
    const isDoctor = profile?.role === 'doctor';

    const [pendingRes, inProgressRes, completedRes] = await Promise.all([
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).eq('results_status', 'pending'),
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).eq('results_status', 'in_progress'),
      supabase.from('visit_tests').select('*', { count: 'exact', head: true }).eq('results_status', 'completed'),
    ]);
    setStatusCounts({
      pending: pendingRes.count || 0,
      in_progress: inProgressRes.count || 0,
      completed: completedRes.count || 0,
    });
  };

  const loadVisitTests = async () => {
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const isDoctor = profile?.role === 'doctor';

      let query = supabase
        .from('visit_tests')
        .select(`
          id,
          visit_id,
          test_id,
          results_status,
          results_entered_at,
          technician_notes,
          sent_to_doctor_at,
          sms_sent_at,
          created_at,
          visit:visits!inner (
            id,
            created_at,
            doctor_id,
            notes,
            diagnosis,
            patient:patients!inner (
              id,
              name,
              phone
            )
          ),
          test:tests!inner (
            name
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('results_status', statusFilter);
      }

      const { data, error, count } = searchTerm
        ? await query
        : await query.range(from, to);

      if (error) throw error;

      let results = (data as any[]) || [];
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        results = results.filter((vt: VisitTest) =>
          vt.visit?.patient?.name?.toLowerCase().includes(lower) ||
          vt.test?.name?.toLowerCase().includes(lower)
        );
      }

      setVisitTests(results);
      setTotalItems(searchTerm ? results.length : (count || 0));
    } catch (error) {
      console.error('Error loading visit tests:', error);
      alert('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const paginatedTests = visitTests;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const handleEnterResults = (visitTestId: string) => {
    if (onEnterResults) {
      onEnterResults(visitTestId);
    }
  };

  const handleViewResults = (visitTestId: string) => {
    if (onViewResults) {
      onViewResults(visitTestId);
    }
  };

  const handleSendToDoctor = async (visitTest: VisitTest) => {
    try {
      const now = getCurrentDateTime();

      const { error: updateError } = await supabase
        .from('visit_tests')
        .update({ sent_to_doctor_at: now })
        .eq('id', visitTest.id);

      if (updateError) throw updateError;

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: visitTest.visit.doctor_id,
          type: 'lab_result_ready',
          title: 'Lab Results Ready',
          message: `Lab results for ${visitTest.test.name} are ready for patient ${visitTest.visit.patient.name}`,
          related_visit_test_id: visitTest.id
        });

      if (notifError) throw notifError;

      await Promise.all([loadVisitTests(), loadStatusCounts()]);
      alert('Results sent to doctor successfully');
    } catch (error) {
      console.error('Error sending results to doctor:', error);
      alert('Failed to send results to doctor');
    }
  };

  const handleSendSMS = async (visitTest: VisitTest) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'doctor' && profile.role !== 'lab_tech')) {
      alert('Only administrators, doctors, and lab technicians can send SMS');
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
      await Promise.all([loadVisitTests(), loadStatusCounts()]);
    } catch (error: any) {
      console.error('Error sending SMS (full):', error);
      const errorMessage = error.message || 'Unknown error';
      console.error('Error message:', errorMessage);
      alert(`Failed to send SMS: ${errorMessage}`);
    } finally {
      setSendingSmsFor(null);
    }
  };

  const handleDeleteResults = async (visitTest: VisitTest) => {
    if (!profile || profile.role !== 'admin') {
      alert('Only administrators can delete lab results');
      return;
    }

    const isPending = visitTest.results_status === 'pending';
    const message = isPending
      ? `Are you sure you want to delete this test order for ${visitTest.test.name}?\n\nPatient: ${visitTest.visit.patient.name}\nThis will remove the entire test request.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete the lab results for ${visitTest.test.name}?\n\nPatient: ${visitTest.visit.patient.name}\nThis will reset the test to pending status.\n\nThis action cannot be undone.`;

    const confirmDelete = confirm(message);
    if (!confirmDelete) return;

    try {
      if (isPending) {
        const { error } = await supabase
          .from('visit_tests')
          .delete()
          .eq('id', visitTest.id);

        if (error) throw error;
        alert('Test order deleted successfully');
      } else {
        const { error: deleteError } = await supabase
          .from('visit_test_results')
          .delete()
          .eq('visit_test_id', visitTest.id);

        if (deleteError) throw deleteError;

        const { error: updateError } = await supabase
          .from('visit_tests')
          .update({
            results_status: 'pending',
            results_entered_at: null,
            results_entered_by: null,
            technician_notes: null,
            sent_to_doctor_at: null,
          })
          .eq('id', visitTest.id);

        if (updateError) throw updateError;
        alert('Lab results deleted successfully');
      }

      await Promise.all([loadVisitTests(), loadStatusCounts()]);
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert(`Failed to delete: ${error.message || 'Unknown error'}`);
    }
  };

  const pendingCount = statusCounts.pending;
  const inProgressCount = statusCounts.in_progress;
  const completedCount = statusCounts.completed;

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
          <h1 className="text-2xl font-bold text-gray-900">Lab Results</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter and manage laboratory test results
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
                  <dt className="text-sm font-medium text-gray-500 uppercase tracking-wider">In Progress</dt>
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
                  Complaint
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
                  Sent to Doctor
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
              {visitTests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
                    No tests found
                  </td>
                </tr>
              ) : (
                paginatedTests.map((vt) => (
                  <tr
                    key={vt.id}
                    className={`
                      ${vt.results_status === 'completed' ? 'bg-green-50 hover:bg-green-100' : ''}
                      ${vt.results_status === 'pending' ? 'bg-yellow-50 hover:bg-yellow-100' : ''}
                      ${vt.results_status === 'in_progress' ? 'bg-blue-50 hover:bg-blue-100' : ''}
                    `}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {vt.visit.patient.name}
                      </div>
                      <div className="text-sm text-gray-500">ID: {vt.visit.patient.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">#{vt.visit.id.slice(0, 8)}</div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(vt.visit.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {vt.visit.notes ? (
                        <button
                          onClick={() => {
                            setSelectedComplaint(vt.visit.notes);
                            setShowComplaintModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-2"
                          title="View complaint"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-sm font-medium">View</span>
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
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
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Send className="w-3 h-3 mr-1" />
                            Sent
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDateTime(vt.sent_to_doctor_at)}
                          </div>
                        </div>
                      ) : vt.results_status === 'completed' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Not Sent
                          </span>
                          <button
                            onClick={() => handleSendToDoctor(vt)}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                            title="Send results to doctor"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
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
                      ) : vt.results_status === 'completed' && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'lab_tech') && vt.visit.patient.phone ? (
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
                      <div className="flex gap-2">
                        {vt.results_status === 'completed' ? (
                          <>
                            <button
                              onClick={() => handleViewResults(vt.id)}
                              className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </button>
                            {(profile?.role === 'admin' || profile?.role === 'lab_tech') && (
                              <button
                                onClick={() => handleEnterResults(vt.id)}
                                className="text-gray-600 hover:text-gray-900 inline-flex items-center"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </button>
                            )}
                            {profile?.role === 'admin' && (
                              <button
                                onClick={() => handleDeleteResults(vt)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center"
                                title="Delete Results"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {(profile?.role === 'admin' || profile?.role === 'lab_tech') && (
                              <button
                                onClick={() => handleEnterResults(vt.id)}
                                className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                              >
                                <FlaskConical className="w-4 h-4 mr-1" />
                                Enter Results
                              </button>
                            )}
                            {profile?.role === 'admin' && (
                              <button
                                onClick={() => handleDeleteResults(vt)}
                                className="text-red-600 hover:text-red-900 inline-flex items-center"
                                title={vt.results_status === 'pending' ? 'Delete Test Order' : 'Delete Results'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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

      {showComplaintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <h2 className="text-xl font-bold text-gray-900">Patient Complaint</h2>
              <button
                onClick={() => setShowComplaintModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {selectedComplaint}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
