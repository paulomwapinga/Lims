import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit, Save, X, TestTube, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TestParameter {
  id: string;
  test_id: string;
  parameter_name: string;
  unit: string | null;
  test_name: string;
  applicable_to_male: boolean;
  applicable_to_female: boolean;
  applicable_to_child: boolean;
  ref_range_from: number | null;
  ref_range_to: number | null;
}

interface InterpretationRule {
  id: string;
  parameter_id: string;
  rule_type: 'numeric_comparison' | 'text_match' | 'range' | 'presence';
  operator: string;
  value: string;
  result_status: 'normal' | 'abnormal' | 'critical';
  priority: number;
  active: boolean;
  parameter?: TestParameter;
}

export default function InterpretationRulesManager() {
  const [rules, setRules] = useState<InterpretationRule[]>([]);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<InterpretationRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    parameter_id: '',
    rule_type: 'numeric_comparison' as const,
    operator: '>' as const,
    value: '',
    result_status: 'abnormal' as const,
    priority: 0,
    active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: paramsData, error: paramsError } = await supabase
        .from('test_parameters')
        .select(`
          id,
          parameter_name,
          unit,
          test_id,
          applicable_to_male,
          applicable_to_female,
          applicable_to_child,
          ref_range_from,
          ref_range_to,
          test:tests!inner(name)
        `)
        .order('parameter_name');

      if (paramsError) throw paramsError;

      const params = (paramsData || []).map((p: any) => ({
        id: p.id,
        parameter_name: p.parameter_name,
        unit: p.unit,
        test_id: p.test_id,
        test_name: p.test.name,
        applicable_to_male: p.applicable_to_male,
        applicable_to_female: p.applicable_to_female,
        applicable_to_child: p.applicable_to_child,
        ref_range_from: p.ref_range_from,
        ref_range_to: p.ref_range_to,
      }));

      setParameters(params);

      const { data: rulesData, error: rulesError } = await supabase
        .from('test_parameter_rules')
        .select('*')
        .order('priority');

      if (rulesError) throw rulesError;

      const rulesWithParams = (rulesData || []).map((rule: any) => ({
        ...rule,
        parameter: params.find((p: TestParameter) => p.id === rule.parameter_id),
      }));

      setRules(rulesWithParams);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load interpretation rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingRule) {
        const { error } = await supabase
          .from('test_parameter_rules')
          .update(formData)
          .eq('id', editingRule.id);

        if (error) throw error;
        alert('Rule updated successfully!');
      } else {
        const { error } = await supabase
          .from('test_parameter_rules')
          .insert(formData);

        if (error) throw error;
        alert('Rule created successfully!');
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('test_parameter_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Rule deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleEdit = (rule: InterpretationRule) => {
    setEditingRule(rule);
    setFormData({
      parameter_id: rule.parameter_id,
      rule_type: rule.rule_type,
      operator: rule.operator as any,
      value: rule.value,
      result_status: rule.result_status,
      priority: rule.priority,
      active: rule.active,
    });
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setFormData({
      parameter_id: '',
      rule_type: 'numeric_comparison',
      operator: '>',
      value: '',
      result_status: 'abnormal',
      priority: 0,
      active: true,
    });
    setEditingRule(null);
    setShowAddDialog(false);
  };

  const getOperatorOptions = (ruleType: string) => {
    switch (ruleType) {
      case 'numeric_comparison':
        return ['>', '<', '>=', '<=', '=', '!='];
      case 'text_match':
        return ['=', '!=', 'in', 'contains'];
      case 'range':
        return ['between'];
      case 'presence':
        return ['exists', 'not_exists'];
      default:
        return [];
    }
  };

  const getApplicabilityLabel = (param: TestParameter) => {
    const labels = [];
    if (param.applicable_to_male) labels.push('Male');
    if (param.applicable_to_female) labels.push('Female');
    if (param.applicable_to_child) labels.push('Child');
    return labels.length > 0 ? labels.join(', ') : 'All';
  };

  const filteredParameters = parameters.filter(param => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      param.parameter_name.toLowerCase().includes(query) ||
      param.test_name.toLowerCase().includes(query) ||
      getApplicabilityLabel(param).toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <div className="text-center py-4">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Interpretation Rules</h3>
          <p className="text-sm text-gray-500">Configure automated result interpretation for test parameters</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Rule</span>
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow text-center py-12 text-gray-500">
          No interpretation rules configured yet
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <TestTube className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <div className="text-base font-semibold text-gray-900">
                          {rule.parameter?.parameter_name}
                        </div>
                        <div className="text-sm text-gray-500">{rule.parameter?.test_name}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <div className="min-w-0 flex-1 max-w-md">
                        <span className="text-xs text-gray-500 block mb-1">Rule</span>
                        <div className="font-mono bg-gray-100 px-3 py-1.5 rounded text-sm font-medium break-all">
                          {rule.operator} {rule.value}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-500 block mb-1">Type</span>
                        <span className="text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded whitespace-nowrap">
                          {rule.rule_type.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-500 block mb-1">Result Status</span>
                        <span
                          className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap ${
                            rule.result_status === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : rule.result_status === 'abnormal'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {rule.result_status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-500 block mb-1">Priority</span>
                        <span className="text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded whitespace-nowrap">
                          {rule.priority}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-500 block mb-1">Status</span>
                        <span
                          className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap ${
                            rule.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {rule.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="flex items-center space-x-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Edit Rule"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="flex items-center space-x-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingRule ? 'Edit' : 'Add'} Interpretation Rule
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Parameter <span className="text-red-500">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search parameters by name, test, or applicability..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  required
                  value={formData.parameter_id}
                  onChange={(e) => setFormData({ ...formData, parameter_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={10}
                >
                  <option value="">Select parameter...</option>
                  {filteredParameters.map((param) => (
                    <option key={param.id} value={param.id}>
                      {param.test_name} - {param.parameter_name}
                      {param.unit && ` (${param.unit})`}
                      {' | '}
                      {getApplicabilityLabel(param)}
                      {param.ref_range_from !== null && param.ref_range_to !== null &&
                        ` | Range: ${param.ref_range_from}-${param.ref_range_to}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Showing {filteredParameters.length} of {parameters.length} parameters
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.rule_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rule_type: e.target.value as any,
                        operator: getOperatorOptions(e.target.value)[0] as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="numeric_comparison">Numeric Comparison</option>
                    <option value="text_match">Text Match</option>
                    <option value="range">Range</option>
                    <option value="presence">Presence Check</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operator <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.operator}
                    onChange={(e) => setFormData({ ...formData, operator: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getOperatorOptions(formData.rule_type).map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 5 or 5/HPF or Positive|Seen|Present"
                />
                <p className="text-xs text-gray-500 mt-1">
                  For text match with multiple values, use | to separate (e.g., Positive|Seen|Present)
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Result Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.result_status}
                    onChange={(e) => setFormData({ ...formData, result_status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="abnormal">Abnormal</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Active</label>
                  <select
                    value={formData.active ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRule ? 'Update' : 'Create'} Rule</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
