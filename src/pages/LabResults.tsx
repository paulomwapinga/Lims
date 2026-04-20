import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateTime } from '../lib/dateFormat';
import { getCurrentDateTime } from '../lib/timezone';
import { FlaskConical, Search, Filter, CheckCircle, Clock, AlertCircle, Eye, CreditCard as Edit, Send, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';

interface VisitTest {
  id: string;
  visit_id: string;
  test_id: string;
  results_status: 'pending' | 'in_progress' | 'completed';
  results_entered_at: string | null;
  technician_notes: string | null;
  sent_to_doctor_at: string | null;
  created_at: string;
  visit: {
    id: string;
    created_at: string;
    doctor_id: string;
    patient: {
      id: string;
      name: string;
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadVisitTests();

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
    }
  }, [refreshTrigger]);

  const loadVisitTests = async () => {
    try {
      const { data, error } = await supabase
        .from('visit_tests')
        .select(`
          id,
          visit_id,
          test_id,
          results_status,
          results_entered_at,
          technician_notes,
          sent_to_doctor_at,
          created_at,
          visit:visits (
            id,
            created_at,
            doctor_id,
            patient:patients (
              id,
              name
            )
          ),
          test:tests (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;
      setVisitTests(data as any || []);
    } catch (error) {
      console.error('Error loading visit tests:', error);
      alert('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = visitTests.filter(vt => {
    const matchesSearch =
      vt.visit.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vt.visit.patient.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vt.visit.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vt.test.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || vt.results_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredTests.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTests = filteredTests.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

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

      await loadVisitTests();
      alert('Results sent to doctor successfully');
    } catch (error) {
      console.error('Error sending results to doctor:', error);
      alert('Failed to send results to doctor');
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

      await loadVisitTests();
    } catch (error: any) {
      console.error('Error deleting:', error);
      alert(`Failed to delete: ${error.message || 'Unknown error'}`);
    }
  };

  const pendingCount = visitTests.filter(vt => vt.results_status === 'pending').length;
  const inProgressCount = visitTests.filter(vt => vt.results_status === 'in_progress').length;
  const completedCount = visitTests.filter(vt => vt.results_status === 'completed').length;

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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                  Sent to Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No tests found
                  </td>
                </tr>
              ) : (
                paginatedTests.map((vt) => (
                  <tr key={vt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vt.visit.patient.name}
                      </div>
                      <div className="text-sm text-gray-500">ID: {vt.visit.patient.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">#{vt.visit.id.slice(0, 8)}</div>
                      <div className="text-sm text-gray-500">
                        {formatDate(vt.visit.created_at)}
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
                            <button
                              onClick={() => handleEnterResults(vt.id)}
                              className="text-gray-600 hover:text-gray-900 inline-flex items-center"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </button>
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
                            <button
                              onClick={() => handleEnterResults(vt.id)}
                              className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                            >
                              <FlaskConical className="w-4 h-4 mr-1" />
                              Enter Results
                            </button>
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
    </div>
  );
}
