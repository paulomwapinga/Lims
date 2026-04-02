import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { Plus, FlaskConical, CreditCard as Edit2, Trash2, Package, ListChecks, GripVertical, Search } from 'lucide-react';
import Pagination from '../components/Pagination';

interface Test {
  id: string;
  name: string;
  price: number;
  notes: string;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  qty_on_hand: number;
}

interface Consumption {
  id: string;
  item_id: string;
  qty_used: number;
  item_name: string;
  item_unit: string;
}

interface Parameter {
  id: string;
  parameter_name: string;
  applicable_to_male: boolean;
  applicable_to_female: boolean;
  applicable_to_child: boolean;
  ref_range_from: number | null;
  ref_range_to: number | null;
  unit: string;
  description: string;
  parameter_type: 'numeric' | 'qualitative' | 'boolean';
  allowed_values: string[] | null;
  sort_order: number;
}

export default function Tests() {
  const { profile } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<'add' | 'edit' | 'bom' | 'parameters' | null>(null);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [draggedParameterId, setDraggedParameterId] = useState<string | null>(null);
  const [editingParameterId, setEditingParameterId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    notes: '',
  });

  const [bomData, setBomData] = useState({
    item_id: '',
    qty_used: '',
  });

  const [parameterData, setParameterData] = useState({
    parameter_name: '',
    applicable_to_male: false,
    applicable_to_female: false,
    applicable_to_child: false,
    ref_range_from: '',
    ref_range_to: '',
    unit: '',
    description: '',
    parameter_type: 'numeric' as 'numeric' | 'qualitative' | 'boolean',
    allowed_values: '',
  });

  useEffect(() => {
    loadTests();
    loadItems();
  }, []);

  async function loadTests() {
    try {
      const { data, error } = await supabase.from('tests').select('*').order('name').limit(500);

      if (error) throw error;
      setTests(data || []);
    } catch (error) {
      console.error('Error loading tests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadItems() {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('type', 'lab_consumable')
        .order('name')
        .limit(500);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }

  async function loadConsumptions(testId: string) {
    try {
      const { data, error } = await supabase
        .from('test_consumables')
        .select(
          `
          id,
          item_id,
          quantity,
          inventory_items(name, unit)
        `
        )
        .eq('test_id', testId);

      if (error) throw error;

      const mapped = data.map((c: any) => ({
        id: c.id,
        item_id: c.item_id,
        qty_used: c.quantity,
        item_name: c.inventory_items.name,
        item_unit: c.inventory_items.unit,
      }));

      setConsumptions(mapped);
    } catch (error) {
      console.error('Error loading consumptions:', error);
    }
  }

  async function loadParameters(testId: string) {
    try {
      const { data, error } = await supabase
        .from('test_parameters')
        .select('*')
        .eq('test_id', testId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setParameters(data || []);
    } catch (error) {
      console.error('Error loading parameters:', error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      if (dialog === 'edit' && selectedTest) {
        const { error } = await supabase
          .from('tests')
          .update({
            name: formData.name,
            price: parseFloat(formData.price),
            notes: formData.notes,
          })
          .eq('id', selectedTest.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('tests').insert({
          name: formData.name,
          price: parseFloat(formData.price),
          notes: formData.notes,
        });

        if (error) throw error;
      }

      closeDialog();
      loadTests();
    } catch (error) {
      console.error('Error saving test:', error);
      alert('Failed to save test');
    }
  }

  async function handleAddConsumption(e: FormEvent) {
    e.preventDefault();

    if (!selectedTest) return;

    try {
      const { error } = await supabase.from('test_consumables').insert({
        test_id: selectedTest.id,
        item_id: bomData.item_id,
        quantity: parseFloat(bomData.qty_used),
      });

      if (error) throw error;

      setBomData({ item_id: '', qty_used: '' });
      loadConsumptions(selectedTest.id);
    } catch (error: any) {
      console.error('Error adding consumption:', error);
      if (error.code === '23505') {
        alert('This item is already in the recipe');
      } else {
        alert('Failed to add consumption item');
      }
    }
  }

  async function handleRemoveConsumption(consumptionId: string) {
    if (!selectedTest) return;

    try {
      const { error } = await supabase
        .from('test_consumables')
        .delete()
        .eq('id', consumptionId);

      if (error) throw error;

      loadConsumptions(selectedTest.id);
    } catch (error) {
      console.error('Error removing consumption:', error);
      alert('Failed to remove consumption item');
    }
  }

  async function handleAddParameter(e: FormEvent) {
    e.preventDefault();

    if (!selectedTest) return;

    if (!parameterData.applicable_to_male && !parameterData.applicable_to_female && !parameterData.applicable_to_child) {
      alert('Please select at least one applicable group (Male/Female/Child)');
      return;
    }

    if (parameterData.parameter_type === 'numeric') {
      if (parameterData.ref_range_from && !parameterData.ref_range_to) {
        alert('Please provide both range from and range to for numeric parameters');
        return;
      }
      if (parameterData.ref_range_to && !parameterData.ref_range_from) {
        alert('Please provide both range from and range to for numeric parameters');
        return;
      }
      if (parameterData.ref_range_from && parameterData.ref_range_to) {
        if (parseFloat(parameterData.ref_range_from) > parseFloat(parameterData.ref_range_to)) {
          alert('Reference range from must be less than or equal to range to');
          return;
        }
      }
    }

    if (parameterData.parameter_type === 'qualitative' || parameterData.parameter_type === 'boolean') {
      if (!parameterData.allowed_values.trim()) {
        alert('Please provide allowed values for qualitative/boolean parameters');
        return;
      }

      const values = parameterData.allowed_values
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length < 2) {
        alert('Please provide at least 2 unique values');
        return;
      }
    }

    try {
      let allowedValuesArray = null;

      if (parameterData.parameter_type === 'qualitative' || parameterData.parameter_type === 'boolean') {
        allowedValuesArray = parameterData.allowed_values
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
        allowedValuesArray = [...new Set(allowedValuesArray)];
      }

      const parameterPayload = {
        test_id: selectedTest.id,
        parameter_name: parameterData.parameter_name,
        applicable_to_male: parameterData.applicable_to_male,
        applicable_to_female: parameterData.applicable_to_female,
        applicable_to_child: parameterData.applicable_to_child,
        ref_range_from: parameterData.parameter_type === 'numeric' && parameterData.ref_range_from ? parseFloat(parameterData.ref_range_from) : null,
        ref_range_to: parameterData.parameter_type === 'numeric' && parameterData.ref_range_to ? parseFloat(parameterData.ref_range_to) : null,
        unit: parameterData.unit,
        description: parameterData.description,
        parameter_type: parameterData.parameter_type,
        allowed_values: allowedValuesArray,
      };

      if (editingParameterId) {
        const { error } = await supabase
          .from('test_parameters')
          .update(parameterPayload)
          .eq('id', editingParameterId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('test_parameters').insert(parameterPayload);

        if (error) throw error;
      }

      setParameterData({
        parameter_name: '',
        applicable_to_male: false,
        applicable_to_female: false,
        applicable_to_child: false,
        ref_range_from: '',
        ref_range_to: '',
        unit: '',
        description: '',
        parameter_type: 'numeric',
        allowed_values: '',
      });
      setEditingParameterId(null);
      loadParameters(selectedTest.id);
    } catch (error) {
      console.error('Error saving parameter:', error);
      alert(`Failed to ${editingParameterId ? 'update' : 'add'} parameter`);
    }
  }

  async function handleRemoveParameter(parameterId: string) {
    if (!selectedTest) return;

    try {
      const { error } = await supabase
        .from('test_parameters')
        .delete()
        .eq('id', parameterId);

      if (error) throw error;

      loadParameters(selectedTest.id);
    } catch (error) {
      console.error('Error removing parameter:', error);
      alert('Failed to remove parameter');
    }
  }

  function handleEditParameter(parameter: Parameter) {
    setEditingParameterId(parameter.id);
    setParameterData({
      parameter_name: parameter.parameter_name,
      applicable_to_male: parameter.applicable_to_male,
      applicable_to_female: parameter.applicable_to_female,
      applicable_to_child: parameter.applicable_to_child,
      ref_range_from: parameter.ref_range_from?.toString() || '',
      ref_range_to: parameter.ref_range_to?.toString() || '',
      unit: parameter.unit || '',
      description: parameter.description || '',
      parameter_type: parameter.parameter_type,
      allowed_values: parameter.allowed_values ? parameter.allowed_values.join(', ') : '',
    });

    const formElement = document.getElementById('parameter-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleCancelEdit() {
    setEditingParameterId(null);
    setParameterData({
      parameter_name: '',
      applicable_to_male: false,
      applicable_to_female: false,
      applicable_to_child: false,
      ref_range_from: '',
      ref_range_to: '',
      unit: '',
      description: '',
      parameter_type: 'numeric',
      allowed_values: '',
    });
  }

  async function handleDelete(test: Test) {
    if (!confirm(`Delete test "${test.name}"? This will also remove its recipe and parameters.`)) return;

    try {
      const { error } = await supabase.from('tests').delete().eq('id', test.id);

      if (error) throw error;
      loadTests();
    } catch (error: any) {
      console.error('Error deleting test:', error);
      if (error.code === '23503') {
        alert(`Cannot delete "${test.name}" because it has been ordered in one or more patient visits. Remove those visit tests first.`);
      } else {
        alert('Failed to delete test');
      }
    }
  }

  function openAddDialog() {
    setFormData({ name: '', price: '', notes: '' });
    setDialog('add');
  }

  function openEditDialog(test: Test) {
    setSelectedTest(test);
    setFormData({
      name: test.name,
      price: test.price.toString(),
      notes: test.notes,
    });
    setDialog('edit');
  }

  function openBomDialog(test: Test) {
    setSelectedTest(test);
    loadConsumptions(test.id);
    setBomData({ item_id: '', qty_used: '' });
    setDialog('bom');
  }

  function openParametersDialog(test: Test) {
    setSelectedTest(test);
    loadParameters(test.id);
    setParameterData({
      parameter_name: '',
      applicable_to_male: false,
      applicable_to_female: false,
      applicable_to_child: false,
      ref_range_from: '',
      ref_range_to: '',
      unit: '',
      description: '',
      parameter_type: 'numeric',
      allowed_values: '',
    });
    setDialog('parameters');
  }

  function closeDialog() {
    setDialog(null);
    setSelectedTest(null);
    setConsumptions([]);
    setParameters([]);
    setEditingParameterId(null);
  }

  function handleDragStart(parameterId: string) {
    setDraggedParameterId(parameterId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(targetParameterId: string) {
    if (!draggedParameterId || draggedParameterId === targetParameterId || !selectedTest) {
      setDraggedParameterId(null);
      return;
    }

    const draggedIndex = parameters.findIndex((p) => p.id === draggedParameterId);
    const targetIndex = parameters.findIndex((p) => p.id === targetParameterId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedParameterId(null);
      return;
    }

    const newParameters = [...parameters];
    const [draggedItem] = newParameters.splice(draggedIndex, 1);
    newParameters.splice(targetIndex, 0, draggedItem);

    const updatedParameters = newParameters.map((p, index) => ({
      ...p,
      sort_order: index,
    }));

    setParameters(updatedParameters);
    setDraggedParameterId(null);

    try {
      const updates = updatedParameters.map((p) => ({
        id: p.id,
        sort_order: p.sort_order,
      }));

      for (const update of updates) {
        await supabase
          .from('test_parameters')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating parameter order:', error);
      loadParameters(selectedTest.id);
    }
  }

  const filteredTests = tests.filter(test =>
    test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = filteredTests.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTests = filteredTests.slice(startIndex, endIndex);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Laboratory Tests</h1>
        {profile?.role === 'admin' && (
          <button
            onClick={openAddDialog}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Test</span>
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search tests by name or notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Test Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Notes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedTests.map((test) => (
              <tr key={test.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <FlaskConical className="w-4 h-4 text-purple-600 mr-2" />
                    <span className="font-medium text-gray-900">{test.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-900 font-medium">
                  {formatCurrency(test.price)}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">{test.notes}</td>
                <td className="px-6 py-4">
                  {profile?.role === 'admin' ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openParametersDialog(test)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
                        title="Manage Parameters"
                      >
                        <ListChecks className="w-3 h-3" />
                        <span>Parameters</span>
                      </button>
                      <button
                        onClick={() => openBomDialog(test)}
                        className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 flex items-center space-x-1"
                        title="Manage Recipe"
                      >
                        <Package className="w-3 h-3" />
                        <span>Recipe</span>
                      </button>
                      <button
                        onClick={() => openEditDialog(test)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(test)}
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

        {tests.length === 0 && (
          <div className="text-center py-12 text-gray-500">No tests found</div>
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
              {dialog === 'add' ? 'Add Test' : 'Edit Test'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Sample type, instructions, etc."
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {dialog === 'add' ? 'Add Test' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog === 'bom' && selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Recipe (BOM) - {selectedTest.name}
            </h2>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Consumables Used</h3>
              {consumptions.length === 0 ? (
                <p className="text-gray-500 text-sm mb-4">No consumables added yet</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {consumptions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <div>
                        <p className="font-medium">{c.item_name}</p>
                        <p className="text-sm text-gray-600">
                          Qty: {c.qty_used} {c.item_unit}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveConsumption(c.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddConsumption} className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">Add Consumable</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lab Consumable <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={bomData.item_id}
                    onChange={(e) => setBomData({ ...bomData, item_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity Used <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={bomData.qty_used}
                    onChange={(e) => setBomData({ ...bomData, qty_used: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Add to Recipe
              </button>
            </form>

            <div className="flex justify-end mt-6 border-t pt-4">
              <button
                onClick={closeDialog}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'parameters' && selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Test Parameters - {selectedTest.name}
            </h2>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">
                Existing Parameters
                {parameters.length > 0 && (
                  <span className="text-sm text-gray-500 ml-2 font-normal">
                    (Drag to reorder)
                  </span>
                )}
              </h3>
              {parameters.length === 0 ? (
                <p className="text-gray-500 text-sm mb-4">No parameters added yet</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {parameters.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(p.id)}
                      className={`bg-gray-50 p-4 rounded cursor-move transition-all ${
                        draggedParameterId === p.id ? 'opacity-50' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2 flex-1">
                          <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <p className="font-semibold text-lg">{p.parameter_name}</p>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    p.parameter_type === 'numeric'
                                      ? 'bg-blue-100 text-blue-800'
                                      : p.parameter_type === 'qualitative'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-orange-100 text-orange-800'
                                  }`}
                                >
                                  {p.parameter_type === 'numeric' && 'Numeric'}
                                  {p.parameter_type === 'qualitative' && 'Qualitative'}
                                  {p.parameter_type === 'boolean' && 'Boolean'}
                                </span>
                                {editingParameterId === p.id && (
                                  <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs rounded-full">
                                    Editing
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">Applicable To:</span>
                                <div className="flex gap-2 mt-1">
                                  {p.applicable_to_male && (
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                      Male
                                    </span>
                                  )}
                                  {p.applicable_to_female && (
                                    <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-xs">
                                      Female
                                    </span>
                                  )}
                                  {p.applicable_to_child && (
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                      Child
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                {p.parameter_type === 'numeric' ? (
                                  <>
                                    <span className="text-gray-600">Reference Range:</span>
                                    <p className="font-medium">
                                      {p.ref_range_from !== null && p.ref_range_to !== null
                                        ? `${p.ref_range_from}–${p.ref_range_to} ${p.unit || ''}`
                                        : 'Not specified'}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-gray-600">Allowed Values:</span>
                                    <p className="font-medium text-xs mt-1">
                                      {p.allowed_values ? p.allowed_values.join(', ') : 'N/A'}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            {p.description && (
                              <p className="text-sm text-gray-600 mt-2 italic">{p.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <button
                            onClick={() => handleEditParameter(p)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveParameter(p.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddParameter} className="border-t pt-4" id="parameter-form">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">
                  {editingParameterId ? 'Edit Parameter' : 'Add Parameter'}
                </h3>
                {editingParameterId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parameter Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={parameterData.parameter_name}
                    onChange={(e) =>
                      setParameterData({ ...parameterData, parameter_name: e.target.value })
                    }
                    placeholder="e.g., Hemoglobin, WBC Count, Color"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parameter Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={parameterData.parameter_type}
                    onChange={(e) => {
                      const newType = e.target.value as 'numeric' | 'qualitative' | 'boolean';
                      setParameterData({
                        ...parameterData,
                        parameter_type: newType,
                        allowed_values: newType === 'boolean' ? 'Positive, Negative' : '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="numeric">Numeric (with ranges)</option>
                    <option value="qualitative">Qualitative (dropdown values)</option>
                    <option value="boolean">Boolean (Positive/Negative)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {parameterData.parameter_type === 'numeric' && 'For values with numeric ranges (e.g., Hemoglobin: 13-17 g/dL)'}
                    {parameterData.parameter_type === 'qualitative' && 'For values from a list (e.g., Color: Yellow, Amber, Red)'}
                    {parameterData.parameter_type === 'boolean' && 'For binary results (e.g., Positive or Negative)'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Applicable To <span className="text-red-500">*</span>
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={parameterData.applicable_to_male}
                        onChange={(e) =>
                          setParameterData({
                            ...parameterData,
                            applicable_to_male: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      <span>Male</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={parameterData.applicable_to_female}
                        onChange={(e) =>
                          setParameterData({
                            ...parameterData,
                            applicable_to_female: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      <span>Female</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={parameterData.applicable_to_child}
                        onChange={(e) =>
                          setParameterData({
                            ...parameterData,
                            applicable_to_child: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      <span>Child</span>
                    </label>
                  </div>
                </div>

                {parameterData.parameter_type === 'numeric' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference Range From
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={parameterData.ref_range_from}
                        onChange={(e) =>
                          setParameterData({ ...parameterData, ref_range_from: e.target.value })
                        }
                        placeholder="Min"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference Range To
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={parameterData.ref_range_to}
                        onChange={(e) =>
                          setParameterData({ ...parameterData, ref_range_to: e.target.value })
                        }
                        placeholder="Max"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <input
                        type="text"
                        value={parameterData.unit}
                        onChange={(e) =>
                          setParameterData({ ...parameterData, unit: e.target.value })
                        }
                        placeholder="e.g., g/dL, cells/µL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Allowed Values <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      value={parameterData.allowed_values}
                      onChange={(e) =>
                        setParameterData({ ...parameterData, allowed_values: e.target.value })
                      }
                      rows={3}
                      placeholder={
                        parameterData.parameter_type === 'boolean'
                          ? 'e.g., Positive, Negative'
                          : 'e.g., Clear, Slightly Turbid, Turbid (separate with commas)'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter values separated by commas. Must provide at least 2 unique values.
                    </p>
                  </div>
                )}

                {(parameterData.parameter_type === 'qualitative' || parameterData.parameter_type === 'boolean') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit (optional)
                    </label>
                    <input
                      type="text"
                      value={parameterData.unit}
                      onChange={(e) =>
                        setParameterData({ ...parameterData, unit: e.target.value })
                      }
                      placeholder="e.g., mg/dL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={parameterData.description}
                    onChange={(e) =>
                      setParameterData({ ...parameterData, description: e.target.value })
                    }
                    rows={2}
                    placeholder="Additional notes or information"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {parameterData.allowed_values && (parameterData.parameter_type === 'qualitative' || parameterData.parameter_type === 'boolean') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900 mb-1">Preview:</p>
                    <p className="text-xs text-blue-700">
                      Doctor will see a dropdown with these options:{' '}
                      {parameterData.allowed_values
                        .split(',')
                        .map((v) => v.trim())
                        .filter((v) => v)
                        .join(', ')}
                    </p>
                  </div>
                )}

                {parameterData.parameter_type === 'numeric' && parameterData.ref_range_from && parameterData.ref_range_to && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900 mb-1">Preview:</p>
                    <p className="text-xs text-blue-700">
                      Doctor will see a numeric input field. Normal range: {parameterData.ref_range_from}–{parameterData.ref_range_to} {parameterData.unit}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingParameterId ? 'Update Parameter' : 'Add Parameter'}
                </button>
              </div>
            </form>

            <div className="flex justify-end mt-6 border-t pt-4">
              <button
                onClick={closeDialog}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
