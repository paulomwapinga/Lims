import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { formatDate, formatTime, getTodayDateString } from '../lib/dateFormat';
import { getTodayStart, getCurrentDateTime, formatDateTimeForInput } from '../lib/timezone';
import { Plus, ShoppingCart, Trash2, Calendar, Search, Eye, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import Pagination from '../components/Pagination';

interface Purchase {
  id: string;
  purchase_date: string;
  total_amount: number;
  supplier: string;
  supplier_id: string | null;
  notes: string;
  items_count: number;
  status: 'draft' | 'completed';
  completed_at: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface PurchaseItemDetail {
  id: string;
  purchase_id: string;
  item_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  item_name: string;
  item_type: string;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  qty_on_hand: number;
}

interface PurchaseItem {
  item_id: string;
  item_name: string;
  item_type: string;
  item_unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface Unit {
  id: string;
  name: string;
  description: string;
}

export default function Purchases() {
  const { user, profile } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItemDetail[]>([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'completed'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [saveNewSupplier, setSaveNewSupplier] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'complete' | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    purchase_date: getTodayDateString(),
    supplier: '',
    supplier_id: null as string | null,
    notes: '',
  });

  const [itemForm, setItemForm] = useState({
    item_id: '',
    quantity: '',
    unit: '',
    unit_price: '',
  });

  const [previousPurchasePrice, setPreviousPurchasePrice] = useState<{
    unit_price: number;
    purchase_date: string;
  } | null>(null);

  useEffect(() => {
    loadPurchases();
    loadItems();
    loadUnits();
    loadSuppliers();
  }, [dateFilter, statusFilter, supplierFilter]);

  async function loadPurchases() {
    try {
      let query = supabase
        .from('purchases')
        .select(`
          id, purchase_date, total_amount, supplier, supplier_id, notes, status, completed_at, created_at,
          purchase_items(id)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      if (dateFilter === 'today') {
        query = query.gte('purchase_date', getTodayStart());
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('purchase_date', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('purchase_date', monthAgo.toISOString());
      }

      const { data: purchasesData, error } = await query;

      if (error) throw error;

      const purchasesWithCounts = (purchasesData || []).map((purchase: any) => ({
        id: purchase.id,
        purchase_date: purchase.purchase_date,
        total_amount: purchase.total_amount,
        supplier: purchase.supplier,
        supplier_id: purchase.supplier_id,
        notes: purchase.notes,
        status: purchase.status,
        completed_at: purchase.completed_at,
        created_at: purchase.created_at,
        items_count: purchase.purchase_items?.length || 0,
      }));

      setPurchases(purchasesWithCounts);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadItems() {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name')
        .limit(500);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }

  async function loadUnits() {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error loading units:', error);
    }
  }

  async function loadSuppliers() {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }

  async function loadPreviousPurchasePrice(itemId: string) {
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          unit_price,
          purchase:purchases!inner (
            purchase_date
          )
        `)
        .eq('item_id', itemId)
        .order('purchase(purchase_date)', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreviousPurchasePrice({
          unit_price: data.unit_price,
          purchase_date: (data.purchase as any).purchase_date,
        });
      } else {
        setPreviousPurchasePrice(null);
      }
    } catch (error) {
      console.error('Error loading previous purchase price:', error);
      setPreviousPurchasePrice(null);
    }
  }

  async function handleAddItem(e: FormEvent) {
    e.preventDefault();

    const item = items.find((i) => i.id === itemForm.item_id);
    if (!item) return;

    if (!itemForm.unit.trim()) {
      alert('Please enter a unit (e.g., box, pcs, strips, bottles)');
      return;
    }

    const quantity = parseFloat(itemForm.quantity);
    const unitPrice = parseFloat(itemForm.unit_price);
    const totalAmount = quantity * unitPrice;

    const existingIndex = purchaseItems.findIndex((pi) => pi.item_id === item.id);
    if (existingIndex >= 0) {
      alert('Item already added. Remove it first to change quantity or price.');
      return;
    }

    setPurchaseItems([
      ...purchaseItems,
      {
        item_id: item.id,
        item_name: item.name,
        item_type: item.type,
        item_unit: itemForm.unit,
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
      },
    ]);

    setItemForm({ item_id: '', quantity: '', unit: '', unit_price: '' });
    setPreviousPurchasePrice(null);
    setSearchTerm('');
  }

  function removeItem(index: number) {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  }

  function handleSubmit(saveAsDraft: boolean = false) {
    if (!user) {
      alert('You must be logged in to add purchases');
      return;
    }

    if (purchaseItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    if (!formData.supplier.trim()) {
      alert('Please enter supplier name');
      return;
    }

    if (!saveAsDraft) {
      setConfirmAction('complete');
      setShowConfirmDialog(true);
    } else {
      completePurchase(true);
    }
  }

  async function completePurchase(saveAsDraft: boolean = false) {
    if (!user) return;

    setShowConfirmDialog(false);
    setConfirmAction(null);
    setSaving(true);

    try {
      let supplierId = formData.supplier_id;

      if (saveNewSupplier && !formData.supplier_id && formData.supplier.trim()) {
        const { data: existingSupplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('name', formData.supplier.trim())
          .maybeSingle();

        if (existingSupplier) {
          supplierId = existingSupplier.id;
        } else {
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert({
              name: formData.supplier.trim(),
              created_by: user.id,
            })
            .select()
            .single();

          if (supplierError) {
            console.error('Error saving supplier:', supplierError);
          } else if (newSupplier) {
            supplierId = newSupplier.id;
            setSuppliers([...suppliers, newSupplier]);
          }
        }
      }

      const grandTotal = calculateGrandTotal();
      const status = saveAsDraft ? 'draft' : 'completed';
      const completedAt = saveAsDraft ? null : getCurrentDateTime();

      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          purchase_date: formData.purchase_date,
          total_amount: grandTotal,
          supplier: formData.supplier,
          supplier_id: supplierId,
          notes: formData.notes,
          status,
          completed_at: completedAt,
          created_by: user.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      const itemsToInsert = purchaseItems.map((item) => ({
        purchase_id: purchaseData.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.item_unit,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      const newPurchaseWithCount = {
        ...purchaseData,
        items_count: purchaseItems.length,
      };
      setPurchases([newPurchaseWithCount, ...purchases]);

      alert(saveAsDraft ? 'Purchase saved as draft!' : 'Purchase completed successfully!');
      closeDialog();
      loadItems();
      loadItems();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Failed to save purchase');
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPurchase(purchase: Purchase) {
    setSelectedPurchase(purchase);
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select(
          `
          id,
          purchase_id,
          item_id,
          quantity,
          unit,
          unit_price,
          total_amount,
          inventory_items(name, type)
        `
        )
        .eq('purchase_id', purchase.id);

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        id: item.id,
        purchase_id: item.purchase_id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_amount: item.total_amount,
        item_name: item.inventory_items.name,
        item_type: item.inventory_items.type,
      }));

      setSelectedPurchaseItems(mapped);
      setShowViewDialog(true);
    } catch (error) {
      console.error('Error loading purchase items:', error);
      alert('Failed to load purchase items');
    }
  }

  async function handleCompleteDraft(purchase: Purchase) {
    if (!confirm(`Complete this draft purchase from ${purchase.supplier}?`)) return;

    try {
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          status: 'completed',
          completed_at: getCurrentDateTime(),
        })
        .eq('id', purchase.id);

      if (updateError) throw updateError;

      setShowViewDialog(false);
      alert('Purchase completed successfully!');
      loadPurchases();
      loadItems();
    } catch (error) {
      console.error('Error completing purchase:', error);
      alert('Failed to complete purchase');
    }
  }

  async function handleDelete(purchase: Purchase) {
    if (!confirm(`Delete this purchase from ${purchase.supplier}?`)) return;

    try {
      const { data, error } = await supabase
        .rpc('delete_purchase', { p_purchase_id: purchase.id });

      if (error) {
        console.error('Error deleting purchase:', error);
        alert(`Failed to delete purchase: ${error.message}`);
        return;
      }

      if (data && !data.success) {
        alert(`Failed to delete purchase: ${data.error}`);
        return;
      }

      alert('Purchase deleted successfully');
      loadPurchases();
      loadItems();
    } catch (error) {
      console.error('Error in delete operation:', error);
      alert('Failed to delete purchase');
    }
  }

  function openDialog() {
    setFormData({
      purchase_date: formatDateTimeForInput(new Date()),
      supplier: '',
      supplier_id: null,
      notes: '',
    });
    setItemForm({
      item_id: '',
      quantity: '',
      unit: '',
      unit_price: '',
    });
    setPurchaseItems([]);
    setSearchTerm('');
    setSupplierSearch('');
    setShowSupplierDropdown(false);
    setSaveNewSupplier(false);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setPreviousPurchasePrice(null);
  }

  function calculateItemTotal() {
    const quantity = parseFloat(itemForm.quantity) || 0;
    const unitPrice = parseFloat(itemForm.unit_price) || 0;
    return quantity * unitPrice;
  }

  function calculateGrandTotal() {
    return purchaseItems.reduce((sum, item) => sum + item.total_amount, 0);
  }

  const totalPurchaseAmount = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);

  const totalItems = purchases.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPurchases = purchases.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, statusFilter, supplierFilter]);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openDialog}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Purchase</span>
          </button>
        )}
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Purchases
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'completed'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'draft'
                ? 'bg-yellow-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Drafts
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Calendar className="w-5 h-5 text-gray-500" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <ShoppingCart className="w-5 h-5 text-gray-500" />
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Purchase Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPurchaseAmount)}</p>
            </div>
          </div>
          {supplierFilter !== 'all' && (
            <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                Showing purchases from:{' '}
                <span className="font-semibold">
                  {suppliers.find((s) => s.id === supplierFilter)?.name}
                </span>
              </span>
              <button
                onClick={() => setSupplierFilter('all')}
                className="ml-auto text-blue-700 hover:text-blue-900"
              >
                <span className="text-lg">&times;</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(purchase.purchase_date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(purchase.completed_at || purchase.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <ShoppingCart className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="font-medium text-gray-900">{purchase.supplier}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {purchase.items_count} item{purchase.items_count !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        purchase.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {purchase.status === 'completed' ? 'Completed' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {purchase.notes || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(purchase.total_amount)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleViewPurchase(purchase)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Items"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {profile?.role === 'admin' && purchase.status === 'draft' && (
                        <button
                          onClick={() => handleCompleteDraft(purchase)}
                          className="text-green-600 hover:text-green-800"
                          title="Complete Draft"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {profile?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(purchase)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {purchases.length === 0 && (
          <div className="text-center py-12 text-gray-500">No purchases found</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {showViewDialog && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Purchase Details</h2>
                <div className="flex items-center space-x-3 mt-2">
                  <p className="text-sm text-gray-500">
                    {formatDate(selectedPurchase.purchase_date)}
                  </p>
                  <span className="text-gray-300">•</span>
                  <p className="text-sm text-gray-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(selectedPurchase.completed_at || selectedPurchase.created_at)}
                  </p>
                  <span className="text-gray-300">•</span>
                  <p className="text-sm text-gray-600">{selectedPurchase.supplier}</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedPurchase.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {selectedPurchase.status === 'completed' ? 'Completed' : 'Draft'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowViewDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {selectedPurchase.notes && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                <p className="text-sm text-gray-600">{selectedPurchase.notes}</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items Purchased</h3>
              <div className="space-y-3">
                {selectedPurchaseItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-gray-50 p-4 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.item_name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.quantity} {item.unit} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total_amount)}
                      </p>
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full ${
                          item.item_type === 'medicine'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {item.item_type === 'medicine' ? 'Medicine' : 'Lab Consumable'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Grand Total:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(selectedPurchase.total_amount)}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedPurchaseItems.length} item{selectedPurchaseItems.length !== 1 ? 's' : ''} in this purchase
              </p>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              {profile?.role === 'admin' && selectedPurchase.status === 'draft' && (
                <button
                  onClick={() => handleCompleteDraft(selectedPurchase)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Purchase</span>
                </button>
              )}
              <button
                onClick={() => setShowViewDialog(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Add Purchase</h2>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) =>
                      setFormData({ ...formData, purchase_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => {
                      setFormData({ ...formData, supplier: e.target.value, supplier_id: null });
                      setSupplierSearch(e.target.value);
                      setShowSupplierDropdown(true);
                      setSaveNewSupplier(false);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="Type to search or enter new supplier"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showSupplierDropdown && formData.supplier && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {suppliers
                        .filter((s) =>
                          s.name.toLowerCase().includes(formData.supplier.toLowerCase())
                        )
                        .map((supplier) => (
                          <div
                            key={supplier.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                supplier: supplier.name,
                                supplier_id: supplier.id,
                              });
                              setShowSupplierDropdown(false);
                              setSaveNewSupplier(false);
                            }}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{supplier.name}</div>
                            {supplier.contact_person && (
                              <div className="text-xs text-gray-500">Contact: {supplier.contact_person}</div>
                            )}
                            {supplier.phone && (
                              <div className="text-xs text-gray-500">Phone: {supplier.phone}</div>
                            )}
                          </div>
                        ))}
                      {!formData.supplier_id &&
                        formData.supplier.trim() &&
                        !suppliers.some(
                          (s) => s.name.toLowerCase() === formData.supplier.toLowerCase()
                        ) && (
                          <div
                            onClick={() => {
                              setSaveNewSupplier(true);
                              setShowSupplierDropdown(false);
                            }}
                            className="px-4 py-2 hover:bg-green-50 cursor-pointer border-t-2 border-green-200 bg-green-50"
                          >
                            <div className="font-medium text-green-700 flex items-center">
                              <Plus className="w-4 h-4 mr-2" />
                              Save "{formData.supplier}" as new supplier
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              This will save the supplier for future use
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                  {saveNewSupplier && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center text-sm text-green-700">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Will save "{formData.supplier}" as new supplier
                      </div>
                      <button
                        type="button"
                        onClick={() => setSaveNewSupplier(false)}
                        className="text-green-700 hover:text-green-900"
                      >
                        <span className="text-lg">&times;</span>
                      </button>
                    </div>
                  )}
                  {formData.supplier_id && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center text-sm text-blue-700">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Using saved supplier
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, supplier: '', supplier_id: null });
                          setSaveNewSupplier(false);
                        }}
                        className="text-blue-700 hover:text-blue-900"
                      >
                        <span className="text-lg">&times;</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Optional notes about this purchase"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Add Items</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Item
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by item name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={itemForm.item_id}
                      onChange={(e) => {
                        const selectedItem = items.find((i) => i.id === e.target.value);
                        let matchedUnit = '';

                        if (selectedItem?.unit) {
                          const itemUnit = selectedItem.unit
                            .toLowerCase()
                            .trim()
                            .replace(/\(s\)/gi, '')
                            .replace(/[^a-z]/g, '');

                          const unitMappings: { [key: string]: string } = {
                            'amp': 'amp',
                            'ampoule': 'amp',
                            'ampule': 'amp',
                            'pac': 'pack',
                            'pkt': 'pack',
                            'pack': 'pack',
                            'strip': 'strip',
                            'strp': 'strip',
                            'tab': 'tab',
                            'tablet': 'tab',
                            'cap': 'cap',
                            'capsule': 'cap',
                            'bottle': 'bottle',
                            'btl': 'bottle',
                            'box': 'box',
                            'vial': 'vial',
                            'tube': 'tube',
                            'sachet': 'sachet',
                            'syringe': 'syringe',
                            'ml': 'ml',
                            'mls': 'mls',
                            'pc': 'pc',
                            'piece': 'pc',
                            'inhaler': 'inhaler',
                            'drops': 'drops',
                          };

                          const normalizedUnit = unitMappings[itemUnit] || itemUnit;

                          const matchedUnitObj = units.find(u =>
                            u.name.toLowerCase() === normalizedUnit ||
                            normalizedUnit.includes(u.name.toLowerCase()) ||
                            u.name.toLowerCase().includes(normalizedUnit)
                          );

                          matchedUnit = matchedUnitObj?.name || '';
                        }

                        setItemForm({
                          ...itemForm,
                          item_id: e.target.value,
                          unit: matchedUnit
                        });

                        if (e.target.value) {
                          loadPreviousPurchasePrice(e.target.value);
                        } else {
                          setPreviousPurchasePrice(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select item</option>
                      {searchTerm ? (
                        items
                          .filter((item) =>
                            item.name.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.unit}) - Stock: {item.qty_on_hand} - {item.type === 'medicine' ? 'Medicine' : 'Lab Consumable'}
                            </option>
                          ))
                      ) : (
                        <>
                          <optgroup label="Medicines">
                            {items
                              .filter((item) => item.type === 'medicine')
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.unit}) - Stock: {item.qty_on_hand}
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="Lab Consumables">
                            {items
                              .filter((item) => item.type === 'lab_consumable')
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.unit}) - Stock: {item.qty_on_hand}
                                </option>
                              ))}
                          </optgroup>
                        </>
                      )}
                    </select>
                    {itemForm.item_id && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Current stock: </span>
                        <span className="font-semibold text-blue-600">
                          {items.find(i => i.id === itemForm.item_id)?.qty_on_hand || 0} {items.find(i => i.id === itemForm.item_id)?.unit}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                        placeholder="e.g., 10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select unit</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.name}>
                            {unit.name} {unit.description && `- ${unit.description}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price (TSh) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={itemForm.unit_price}
                        onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })}
                        placeholder="Price per unit"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {previousPurchasePrice && (
                        <p className="text-xs text-gray-600 mt-1">
                          Last purchased at {formatCurrency(previousPurchasePrice.unit_price)} on{' '}
                          {formatDate(previousPurchasePrice.purchase_date)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Total
                      </label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-medium">
                        {formatCurrency(calculateItemTotal())}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Item to Purchase</span>
                  </button>
                </form>
              </div>

              {purchaseItems.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Items in Purchase</h3>
                  <div className="space-y-2 mb-4">
                    {purchaseItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.item_name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} {item.item_unit} × {formatCurrency(item.unit_price)} = {formatCurrency(item.total_amount)}
                          </p>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                              item.item_type === 'medicine'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {item.item_type === 'medicine' ? 'Medicine' : 'Lab Consumable'}
                          </span>
                        </div>
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 ml-4"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Grand Total:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(calculateGrandTotal())}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {purchaseItems.length} item{purchaseItems.length !== 1 ? 's' : ''} in this purchase
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between border-t pt-6">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={purchaseItems.length === 0 || saving}
                    className={`px-4 py-2 rounded-lg ${
                      purchaseItems.length === 0 || saving
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-yellow-600 text-white hover:bg-yellow-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={purchaseItems.length === 0 || saving}
                    className={`px-4 py-2 rounded-lg ${
                      purchaseItems.length === 0 || saving
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {saving ? 'Processing...' : `Complete Purchase (${purchaseItems.length} item${purchaseItems.length !== 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && confirmAction === 'complete' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Confirm Purchase Completion</h3>
            <p className="text-gray-600 mb-2">
              Are you sure you want to complete this purchase?
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Supplier:</span>
                  <span className="font-semibold">{formData.supplier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-semibold">{purchaseItems.length} item{purchaseItems.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(calculateGrandTotal())}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              This will update the inventory quantities and cannot be undone easily.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                }}
                disabled={saving}
                className={`px-4 py-2 rounded-lg ${
                  saving
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => completePurchase(false)}
                disabled={saving}
                className={`px-4 py-2 rounded-lg ${
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {saving ? 'Processing...' : 'Confirm & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
