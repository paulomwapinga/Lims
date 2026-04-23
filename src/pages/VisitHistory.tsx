import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { Calendar, User, FileText, Eye, Search, AlertCircle, CheckCircle, Clock } from 'lucide-react';
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
  tests_count: number;
  pending_tests: number;
  in_progress_tests: number;
  completed_tests: number;
}

interface Totals {
  total_revenue: number;
  total_collected: number;
  total_balance: number;
  total_visits: number;
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
  const [totalItems, setTotalItems] = useState(0);
  const [totals, setTotals] = useState<Totals>({ total_revenue: 0, total_collected: 0, total_balance: 0, total_visits: 0 });
  const itemsPerPage = 20;

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;

      const [{ data: rows, error }, { data: countData, error: countError }, { data: totalsData, error: totalsError }] = await Promise.all([
        supabase.rpc('get_visit_history_paginated', {
          p_search: debouncedSearch,
          p_status: statusFilter,
          p_limit: itemsPerPage,
          p_offset: offset,
        }),
        supabase.rpc('get_visit_history_count', {
          p_search: debouncedSearch,
          p_status: statusFilter,
        }),
        supabase.rpc('get_visit_history_totals', {
          p_search: debouncedSearch,
          p_status: statusFilter,
        }),
      ]);

      if (error) throw error;
      if (countError) throw countError;
      if (totalsError) throw totalsError;

      setVisits((rows as Visit[]) || []);
      setTotalItems(Number(countData) || 0);
      if (totalsData && (totalsData as Totals[]).length > 0) {
        const t = (totalsData as Totals[])[0];
        setTotals({
          total_revenue: Number(t.total_revenue) || 0,
          total_collected: Number(t.total_collected) || 0,
          total_balance: Number(t.total_balance) || 0,
          total_visits: Number(t.total_visits) || 0,
        });
      }
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  function getStatusColor(status: string) {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading && visits.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading visit history...</p>
        </div>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Visits</p>
                <p className="text-3xl font-bold mt-2">{totals.total_visits}</p>
              </div>
              <Calendar className="w-10 h-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                <p className="text-2xl font-bold mt-2">{formatCurrency(totals.total_revenue)}</p>
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
                <p className="text-2xl font-bold mt-2">{formatCurrency(totals.total_collected)}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Outstanding</p>
                <p className="text-2xl font-bold mt-2">{formatCurrency(totals.total_balance)}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-200" />
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
        {!loading && visits.length === 0 ? (
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Doctor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Diagnosis</th>
                  {profile?.role !== 'doctor' && (
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Financial</th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tests</th>
                  {profile?.role !== 'doctor' && (
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td>
                  </tr>
                ) : (
                  visits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(visit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(visit.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
                            <div className="text-sm font-semibold text-gray-900">{visit.patient_name}</div>
                            <div className="text-xs text-gray-500">ID: {visit.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{visit.doctor_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center max-w-xs">
                          <FileText className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate">{visit.diagnosis || 'N/A'}</span>
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
                              <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full capitalize ${getStatusColor(visit.payment_status)}`}>
                                {visit.payment_status}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {visit.tests_count > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {visit.pending_tests > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {visit.pending_tests} Pending
                              </span>
                            )}
                            {visit.in_progress_tests > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-yellow-100 text-yellow-800 text-xs font-medium">
                                <Clock className="w-3 h-3 mr-1" />
                                {visit.in_progress_tests} In Progress
                              </span>
                            )}
                            {visit.completed_tests > 0 && (
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
                  ))
                )}
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
