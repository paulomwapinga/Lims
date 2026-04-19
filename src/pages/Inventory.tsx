import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { Plus, Package, AlertTriangle, ArrowUp, Edit2, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';

interface InventoryItem {
  id: string;
  name: string;
  type: 'medicine' | 'lab_consumable';
  unit: string;
  qty_on_hand: number;
  reorder_level: number;
  cost_price: number;
  sell_price: number;
}

type DialogType = 'add' | 'edit' | 'stock-in' | 'adjust' | null;

export default function Inventory() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    name: '',
    type: 'medicine' as 'medicine' | 'lab_consumable',
    unit: '',
    qty_on_hand: '0',
    reorder_level: '0',
    cost_price: '0',
    sell_price: '0',
  });

  const [stockData, setStockData] = useState({
    qty: '',
    reason: '',
  });

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      if (dialog === 'edit' && selectedItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            name: formData.name,
            type: formData.type,
            unit: formData.unit,
            reorder_level: parseFloat(formData.reorder_level),
            cost_price: parseFloat(formData.cost_price),
            sell_price: parseFloat(formData.sell_price),
          })
          .eq('id', selectedItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory_items').insert({
          name: formData.name,
          type: formData.type,
          unit: formData.unit,
          qty_on_hand: parseFloat(formData.qty_on_hand),
          reorder_level: parseFloat(formData.reorder_level),
          cost_price: parseFloat(formData.cost_price),
          sell_price: parseFloat(formData.sell_price),
        });

        if (error) throw error;
      }

      closeDialog();
      loadInventory();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  }

  async function handleStockOperation(e: FormEvent) {
    e.preventDefault();

    if (!selectedItem || !profile) return;

    const qty = parseFloat(stockData.qty);
    if (qty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    try {
      if (dialog === 'stock-in') {
        const newQty = selectedItem.qty_on_hand + qty;

        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({ qty_on_hand: newQty })
          .eq('id', selectedItem.id);

        if (updateError) throw updateError;

        const { error: movementError } = await supabase.from('stock_movements').insert({
          item_id: selectedItem.id,
          movement_type: 'IN',
          qty: qty,
          reason: stockData.reason || 'Stock purchase',
          reference_type: 'purchase',
          reference_id: null,
          performed_by: profile.id,
        });

        if (movementError) throw movementError;
      } else if (dialog === 'adjust') {
        const { error: updateError } = await supabase
          .from('inventory_items')
          .update({ qty_on_hand: qty })
          .eq('id', selectedItem.id);

        if (updateError) throw updateError;

        const { error: movementError } = await supabase.from('stock_movements').insert({
          item_id: selectedItem.id,
          movement_type: 'ADJUST',
          qty: qty - selectedItem.qty_on_hand,
          reason: stockData.reason || 'Stock adjustment',
          reference_type: 'adjustment',
          reference_id: null,
          performed_by: profile.id,
        });

        if (movementError) throw movementError;
      }

      closeDialog();
      loadInventory();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    }
  }

  function openAddDialog() {
    setFormData({
      name: '',
      type: 'medicine',
      unit: '',
      qty_on_hand: '0',
      reorder_level: '0',
      cost_price: '0',
      sell_price: '0',
    });
    setDialog('add');
  }

  function openEditDialog(item: InventoryItem) {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      unit: item.unit,
      qty_on_hand: item.qty_on_hand.toString(),
      reorder_level: item.reorder_level.toString(),
      cost_price: item.cost_price.toString(),
      sell_price: item.sell_price.toString(),
    });
    setDialog('edit');
  }

  function openStockDialog(item: InventoryItem, type: 'stock-in' | 'adjust') {
    setSelectedItem(item);
    setStockData({ qty: type === 'adjust' ? item.qty_on_hand.toString() : '', reason: '' });
    setDialog(type);
  }

  function closeDialog() {
    setDialog(null);
    setSelectedItem(null);
    setStockData({ qty: '', reason: '' });
  }

  async function handleDeleteItem(item: InventoryItem) {
    if (!profile || profile.role !== 'admin') {
      alert('Only administrators can delete inventory items');
      return;
    }

    const confirmDelete = confirm(
      `Are you sure you want to delete "${item.name}"?\n\nThis will:\n- Remove the item from inventory\n- Delete all associated stock movement history\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      alert('Item deleted successfully');
      loadInventory();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      alert(`Failed to delete item: ${error.message || 'Unknown error'}`);
    }
  }

  const filteredItems =
    filter === 'low'
      ? items.filter((item) => item.qty_on_hand <= item.reorder_level)
      : items;

  const totalItems = filteredItems.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openAddDialog}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Item</span>
          </button>
        )}
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          All Items ({items.length})
        </button>
        <button
          onClick={() => setFilter('low')}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
            filter === 'low'
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>
            Low Stock ({items.filter((item) => item.qty_on_hand <= item.reorder_level).length})
          </span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Qty on Hand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Unit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sell Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedItems.map((item) => (
              <tr
                key={item.id}
                className={
                  item.qty_on_hand <= item.reorder_level ? 'bg-red-50' : 'hover:bg-gray-50'
                }
              >
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <Package className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="font-medium text-gray-900">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      item.type === 'medicine'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {item.type === 'medicine' ? 'Medicine' : 'Lab Consumable'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={
                      item.qty_on_hand <= item.reorder_level
                        ? 'font-bold text-red-600'
                        : 'text-gray-900'
                    }
                  >
                    {item.qty_on_hand}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{item.unit}</td>
                <td className="px-6 py-4 text-gray-900">{formatCurrency(item.sell_price)}</td>
                <td className="px-6 py-4">
                  {profile?.role === 'admin' ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditDialog(item)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openStockDialog(item, 'stock-in')}
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                        title="Stock In"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openStockDialog(item, 'adjust')}
                        className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700"
                        title="Adjust"
                      >
                        Adjust
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-500">No items found</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {(dialog === 'add' || dialog === 'edit') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4">
              {dialog === 'add' ? 'Add Inventory Item' : 'Edit Inventory Item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'medicine' | 'lab_consumable',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="medicine">Medicine</option>
                    <option value="lab_consumable">Lab Consumable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="tabs, ml, pcs, strips"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {dialog === 'add' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.qty_on_hand}
                    onChange={(e) => setFormData({ ...formData, qty_on_hand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sell Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sell_price}
                    onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {dialog === 'add' ? 'Add Item' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(dialog === 'stock-in' || dialog === 'adjust') && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {dialog === 'stock-in' ? 'Stock In' : 'Adjust Stock'} - {selectedItem.name}
            </h2>
            <form onSubmit={handleStockOperation} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">Current Stock</p>
                <p className="text-2xl font-bold">
                  {selectedItem.qty_on_hand} {selectedItem.unit}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {dialog === 'stock-in' ? 'Quantity to Add' : 'New Quantity'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={stockData.qty}
                  onChange={(e) => setStockData({ ...stockData, qty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={stockData.reason}
                  onChange={(e) => setStockData({ ...stockData, reason: e.target.value })}
                  rows={3}
                  placeholder={
                    dialog === 'stock-in'
                      ? 'e.g., Supplier name, invoice number'
                      : 'e.g., Expired, damaged, count correction'
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg ${
                    dialog === 'stock-in'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
