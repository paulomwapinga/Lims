import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { formatDate as formatDateDDMMYYYY, formatTime } from '../lib/dateFormat';
import { Calendar, User, FileText, Eye, Search, FlaskConical, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Pagination from '../components/Pagination';

interface Visit {
  id: string;
  created_at: string;
  patient_name: string;
  doctor_name: string;
  total: number;
  payment_status: 'paid' | 'unpaid' | 'partial';
  paid: number;
  balance: number;
  diagnosis: string;
  notes: string;
  tests_count?: number;
  pending_tests?: number;
  in_progress_tests?: number;
  completed_tests?: number;
}

interface VisitHistoryProps {
  onViewReceipt: (visitId: string) => void;
}

export default function VisitHistory({ onViewReceipt }: VisitHistoryProps) {
  const { profile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [totalPatients, setTotalPatients] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadAllData = async () => {
      try {
        const patientsPromise = supabase
          .from('patients')
          .select('*', { count: 'exact', head: true });

        const visitsPromise = supabase
          .from('visits')
          .select(
            `
            id,
            created_at,
            total,
            payment_status,
            paid,
            balance,
            diagnosis,
            notes,
            patients(name),
            users(name)
          `
          )
          .order('created_at', { ascending: false });

        const [patientsResult, visitsResult] = await Promise.all([
          patientsPromise,
          visitsPromise
        ]);

        if (!mounted) return;

        if (patientsResult.error) throw patientsResult.error;
        if (visitsResult.error) throw visitsResult.error;

        setTotalPatients(patientsResult.count || 0);

        if (!visitsResult.data || visitsResult.data.length === 0) {
          setVisits([]);
          setLoading(false);
          return;
        }

        const visitIds = visitsResult.data.map(v => v.id);
        const visitIdSet = new Set(visitIds);

        // Fetch ALL visit tests without filtering by visit_id to avoid URL length limits
        // Then filter in memory
        const { data: allVisitTestsRaw, error: testsError } = await supabase
          .from('visit_tests')
          .select('visit_id, results_status')
          .limit(100000);

        if (testsError) {
          console.error('[VisitHistory] Error loading visit tests:', testsError);
          console.error('[VisitHistory] Error details:', JSON.stringify(testsError, null, 2));
        }

        // Filter to only include tests for loaded visits
        const allVisitTests = (allVisitTestsRaw || []).filter(test => visitIdSet.has(test.visit_id));

        if (!mounted) return;

        const testsByVisit = (allVisitTests || []).reduce((acc: any, test) => {
          if (!acc[test.visit_id]) {
            acc[test.visit_id] = { total: 0, pending: 0, inProgress: 0, completed: 0 };
          }
          acc[test.visit_id].total++;
          if (test.results_status === 'pending') acc[test.visit_id].pending++;
          if (test.results_status === 'in_progress') acc[test.visit_id].inProgress++;
          if (test.results_status === 'completed') acc[test.visit_id].completed++;
          return acc;
        }, {});

        const visitsWithTests = visitsResult.data.map((v: any) => {
          const testStats = testsByVisit[v.id] || { total: 0, pending: 0, inProgress: 0, completed: 0 };

          return {
            id: v.id,
            created_at: v.created_at,
            patient_name: v.patients?.name || 'Unknown',
            doctor_name: v.users?.name || 'Unknown',
            total: v.total,
            payment_status: v.payment_status,
            paid: v.paid,
            balance: v.balance,
            diagnosis: v.diagnosis,
            notes: v.notes,
            tests_count: testStats.total,
            pending_tests: testStats.pending,
            in_progress_tests: testStats.inProgress,
            completed_tests: testStats.completed,
          };
        });

        setVisits(visitsWithTests);
      } catch (error: any) {
        if (!mounted) {
          return;
        }
        console.error('Error loading visits:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAllData();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadTotalPatients() {
    try {
      const { count, error } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      setTotalPatients(count || 0);
    } catch (error) {
      console.error('Error loading total patients:', error);
    }
  }

  async function loadVisits() {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select(
          `
          id,
          created_at,
          total,
          payment_status,
          paid,
          balance,
          diagnosis,
          notes,
          patients(name),
          users(name)
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setVisits([]);
        return;
      }

      const visitIds = data.map(v => v.id);
      const visitIdSet = new Set(visitIds);

      // Fetch ALL visit tests - Supabase has a default 1000 row limit
      const { data: allVisitTestsRaw, error: testsError } = await supabase
        .from('visit_tests')
        .select('visit_id, results_status')
        .limit(100000);

      if (testsError) {
        console.error('Error loading visit tests:', testsError);
      }

      // Filter to only include tests for loaded visits
      const allVisitTests = (allVisitTestsRaw || []).filter(test => visitIdSet.has(test.visit_id));

      const testsByVisit = (allVisitTests || []).reduce((acc: any, test) => {
        if (!acc[test.visit_id]) {
          acc[test.visit_id] = { total: 0, pending: 0, inProgress: 0, completed: 0 };
        }
        acc[test.visit_id].total++;
        if (test.results_status === 'pending') acc[test.visit_id].pending++;
        if (test.results_status === 'in_progress') acc[test.visit_id].inProgress++;
        if (test.results_status === 'completed') acc[test.visit_id].completed++;
        return acc;
      }, {});

      const visitsWithTests = data.map((v: any) => {
        const testStats = testsByVisit[v.id] || { total: 0, pending: 0, inProgress: 0, completed: 0 };

        return {
          id: v.id,
          created_at: v.created_at,
          patient_name: v.patients?.name || 'Unknown',
          doctor_name: v.users?.name || 'Unknown',
          total: v.total,
          payment_status: v.payment_status,
          paid: v.paid,
          balance: v.balance,
          diagnosis: v.diagnosis,
          notes: v.notes,
          tests_count: testStats.total,
          pending_tests: testStats.pending,
          in_progress_tests: testStats.inProgress,
          completed_tests: testStats.completed,
        };
      });

      setVisits(visitsWithTests);
    } catch (error) {
      console.error('Error loading visits:', error);
    }
  }

  const filteredVisits = visits.filter((visit) => {
    const matchesSearch =
      visit.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.doctor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.diagnosis.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || visit.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredVisits.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVisits = filteredVisits.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading visit history...</p>
        </div>
      </div>
    );
  }

  const totalRevenue = filteredVisits.reduce((sum, visit) => sum + visit.total, 0);
  const totalCollected = filteredVisits.reduce((sum, visit) => sum + visit.paid, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Visit History</h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete history of all patient visits
          </p>
        </div>
      </div>

      {profile?.role !== 'doctor' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Patients</p>
                <p className="text-3xl font-bold mt-2">{totalPatients}</p>
              </div>
              <User className="w-10 h-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-lg font-bold mt-2">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-400 rounded-full flex items-center justify-center text-xl font-bold">
                ₦
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Collected</p>
                <p className="text-lg font-bold mt-2">{formatCurrency(totalCollected)}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-200" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient, doctor, or diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        {filteredVisits.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No visits found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Visit records will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Doctor
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Diagnosis
                  </th>
                  {profile?.role !== 'doctor' && (
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Financial
                    </th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Tests
                  </th>
                  {profile?.role !== 'doctor' && (
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedVisits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(visit.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(visit.created_at).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {visit.patient_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {visit.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{visit.doctor_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center max-w-xs">
                        <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">
                          {visit.diagnosis || 'N/A'}
                        </span>
                      </div>
                    </td>
                    {profile?.role !== 'doctor' && (
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Total:</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(visit.total)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Paid:</span>
                            <span className="text-sm font-semibold text-green-600">{formatCurrency(visit.paid)}</span>
                          </div>
                          {visit.balance > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Balance:</span>
                              <span className="text-sm font-semibold text-red-600">{formatCurrency(visit.balance)}</span>
                            </div>
                          )}
                          <div className="pt-1">
                            <span
                              className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full capitalize ${getStatusColor(
                                visit.payment_status
                              )}`}
                            >
                              {visit.payment_status}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {(visit.tests_count ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {visit.pending_tests! > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {visit.pending_tests} Pending
                            </span>
                          )}
                          {visit.in_progress_tests! > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-medium">
                              <Clock className="w-3 h-3 mr-1" />
                              {visit.in_progress_tests} In Progress
                            </span>
                          )}
                          {visit.completed_tests! > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs font-medium">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {visit.completed_tests} Done
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No tests ordered</span>
                      )}
                    </td>
                    {profile?.role !== 'doctor' && (
                      <td className="px-6 py-4">
                        <button
                          onClick={() => onViewReceipt(visit.id)}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                          title="View Receipt"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          View
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
