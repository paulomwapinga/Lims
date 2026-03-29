import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Trash2, Package, Building2, Mail, Phone, MapPin, Calendar, DollarSign } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { formatDate } from '../lib/dateFormat';
import Pagination from '../components/Pagination';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

interface Purchase {
  id: string;
  purchase_date: string;
  total_amount: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  users: {
    name: string;
  };
}

interface SupplierWithStats extends Supplier {
  total_purchases: number;
  total_amount: number;
  last_purchase_date: string | null;
}

export default function Suppliers() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select(`
          *,
          purchases!supplier_id (
            id,
            total_amount,
            purchase_date,
            status
          )
        `)
        .order('name');

      if (error) throw error;

      const suppliersWithStats: SupplierWithStats[] = (data || []).map(supplier => {
        const completedPurchases = supplier.purchases?.filter((p: any) => p.status === 'completed') || [];
        const totalAmount = completedPurchases.reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);
        const lastPurchase = completedPurchases.sort((a: any, b: any) =>
          new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
        )[0];

        return {
          id: supplier.id,
          name: supplier.name,
          contact_person: supplier.contact_person,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          created_at: supplier.created_at,
          updated_at: supplier.updated_at,
          total_purchases: completedPurchases.length,
          total_amount: totalAmount,
          last_purchase_date: lastPurchase?.purchase_date || null,
        };
      });

      setSuppliers(suppliersWithStats);
    } catch (error: any) {
      alert('Error loading suppliers: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPurchaseHistory(supplierId: string) {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          users!purchases_created_by_fkey (
            name
          )
        `)
        .eq('supplier_id', supplierId)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchaseHistory(data || []);
    } catch (error: any) {
      alert('Error loading purchase history: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('suppliers')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        alert('Supplier updated successfully');
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([formData]);

        if (error) throw error;
        alert('Supplier added successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
      fetchSuppliers();
    } catch (error: any) {
      alert('Error saving supplier: ' + error.message);
    }
  }

  function handleEdit(supplier: SupplierWithStats) {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    setShowForm(true);
    setSelectedSupplier(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete supplier "${name}"?\n\nNote: You can only delete suppliers that have no associated purchases.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === '23503') {
          alert('Cannot delete this supplier because they have associated purchases. Please remove or reassign the purchases first.');
        } else {
          throw error;
        }
        return;
      }

      alert('Supplier deleted successfully');
      fetchSuppliers();
    } catch (error: any) {
      alert('Error deleting supplier: ' + error.message);
    }
  }

  function handleViewHistory(supplier: Supplier) {
    setSelectedSupplier(supplier);
    fetchPurchaseHistory(supplier.id);
    setShowForm(false);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
  }

  const totalPages = Math.ceil(suppliers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSuppliers = suppliers.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600 mt-1">Manage your suppliers and view purchase history</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedSupplier(null);
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Supplier</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Supplier' : 'Add New Supplier'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? 'Update' : 'Add'} Supplier
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedSupplier && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Purchase History</h2>
                <p className="text-gray-600 mt-1">Supplier: {selectedSupplier.name}</p>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
          </div>
          <div className="p-6">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : purchaseHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No purchases found for this supplier</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseHistory.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(purchase.purchase_date)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(purchase.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            purchase.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {purchase.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {purchase.users?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {purchase.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Purchases
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Purchase
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No suppliers found</p>
                    <p className="text-sm">Click "Add Supplier" to get started</p>
                  </td>
                </tr>
              ) : (
                currentSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                        {supplier.address && (
                          <div className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {supplier.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {supplier.contact_person && (
                          <div className="text-sm text-gray-900">{supplier.contact_person}</div>
                        )}
                        {supplier.phone && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {supplier.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {supplier.total_purchases}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(supplier.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {supplier.last_purchase_date ? (
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(supplier.last_purchase_date)}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewHistory(supplier)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View purchase history"
                        >
                          <Package className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="text-green-600 hover:text-green-900"
                          title="Edit supplier"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete supplier"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
