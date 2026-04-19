import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Upload, Plus, Trash2, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface ClinicSettings {
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
  clinic_logo_url: string;
  clinic_website: string;
  currency: string;
}

interface Unit {
  id: string;
  name: string;
  description: string;
}

export default function Settings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ClinicSettings>({
    clinic_name: '',
    clinic_address: '',
    clinic_phone: '',
    clinic_email: '',
    clinic_logo_url: '',
    clinic_website: '',
    currency: 'TSh',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnit, setNewUnit] = useState({ name: '', description: '' });
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUnits();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');

      if (error) throw error;

      if (data) {
        const settingsMap: any = {};
        data.forEach((item) => {
          settingsMap[item.key] = item.value;
        });

        setSettings({
          clinic_name: settingsMap.clinic_name || 'Remtullah Medical Laboratory',
          clinic_address: settingsMap.clinic_address || '',
          clinic_phone: settingsMap.clinic_phone || '',
          clinic_email: settingsMap.clinic_email || '',
          clinic_logo_url: settingsMap.clinic_logo_url || '/20260201_200954.jpg',
          clinic_website: settingsMap.clinic_website || '',
          currency: settingsMap.currency || 'TSh',
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      alert(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (profile?.role !== 'admin') {
      alert('Only administrators can update settings');
      return;
    }

    setSaving(true);
    try {
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        key,
        value: value || '',
      }));

      for (const setting of settingsArray) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: setting.key, value: setting.value },
            { onConflict: 'key' }
          );

        if (error) throw error;
      }

      alert('Settings saved successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof ClinicSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const loadUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error: any) {
      console.error('Error loading units:', error);
    }
  };

  const handleAddUnit = async () => {
    if (!newUnit.name.trim()) {
      alert('Unit name is required');
      return;
    }

    if (profile?.role !== 'admin') {
      alert('Only administrators can add units');
      return;
    }

    setAddingUnit(true);
    try {
      const { error } = await supabase
        .from('units')
        .insert({
          name: newUnit.name.trim(),
          description: newUnit.description.trim(),
        });

      if (error) throw error;

      setNewUnit({ name: '', description: '' });
      setShowAddUnit(false);
      loadUnits();
      alert('Unit added successfully');
    } catch (error: any) {
      console.error('Error adding unit:', error);
      alert(`Failed to add unit: ${error.message}`);
    } finally {
      setAddingUnit(false);
    }
  };

  const handleDeleteUnit = async (id: string, name: string) => {
    if (profile?.role !== 'admin') {
      alert('Only administrators can delete units');
      return;
    }

    if (!confirm(`Are you sure you want to delete the unit "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadUnits();
      alert('Unit deleted successfully');
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      alert(`Failed to delete unit: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <SettingsIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">System configuration</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Clinic Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clinic Name
                </label>
                <input
                  type="text"
                  value={settings.clinic_name}
                  onChange={(e) => handleChange('clinic_name', e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Enter clinic name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={settings.clinic_address}
                  onChange={(e) => handleChange('clinic_address', e.target.value)}
                  disabled={!isAdmin}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Enter clinic address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={settings.clinic_phone}
                    onChange={(e) => handleChange('clinic_phone', e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="e.g., +255 123 456 789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.clinic_email}
                    onChange={(e) => handleChange('clinic_email', e.target.value)}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="e.g., info@clinic.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="text"
                  value={settings.clinic_website}
                  onChange={(e) => handleChange('clinic_website', e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="e.g., www.clinic.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL
                </label>
                <div className="flex items-start space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={settings.clinic_logo_url}
                      onChange={(e) => handleChange('clinic_logo_url', e.target.value)}
                      disabled={!isAdmin}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="e.g., /logo.png"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the path to your logo image (e.g., /logo.png)
                    </p>
                  </div>
                  {settings.clinic_logo_url && (
                    <div className="flex-shrink-0">
                      <img
                        src={settings.clinic_logo_url}
                        alt="Clinic Logo Preview"
                        className="h-16 w-auto object-contain border border-gray-200 rounded-md p-2"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {!isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Only administrators can modify clinic information settings.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Currency</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">System Currency</p>
                  <p className="text-sm text-gray-500 mt-1">
                    All financial transactions and reports use this currency
                  </p>
                </div>
                <div className="text-2xl font-bold text-gray-900">{settings.currency}</div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">Units Management</h2>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddUnit(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Unit
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Define units used for purchases and medicine dispensing
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {units.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No units defined</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {units.map((unit) => (
                    <div
                      key={unit.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{unit.name}</p>
                        {unit.description && (
                          <p className="text-xs text-gray-500 truncate">{unit.description}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteUnit(unit.id, unit.name)}
                          className="ml-2 text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isAdmin && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-yellow-800">
                  Only administrators can add or remove units.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddUnit && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Add New Unit</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUnit.name}
                  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                  placeholder="e.g., kg, mg, l"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newUnit.description}
                  onChange={(e) => setNewUnit({ ...newUnit, description: e.target.value })}
                  placeholder="e.g., Kilogram"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowAddUnit(false);
                  setNewUnit({ name: '', description: '' });
                }}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUnit}
                disabled={addingUnit}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm hover:shadow-md transition-all disabled:bg-gray-400"
              >
                {addingUnit ? 'Adding...' : 'Add Unit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
