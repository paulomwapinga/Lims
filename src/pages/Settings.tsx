import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Upload, Plus, Trash2, Package, FileSignature, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import InterpretationRulesManager from '../components/InterpretationRulesManager';

interface ClinicSettings {
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
  clinic_logo_url: string;
  clinic_website: string;
  currency: string;
  signature_image: string;
}

interface SmsSettings {
  sms_enabled: boolean;
  sms_api_key: string;
  sms_secret_key: string;
  sms_source_addr: string;
  sms_template: string;
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
    signature_image: '',
  });
  const [smsSettings, setSmsSettings] = useState<SmsSettings>({
    sms_enabled: false,
    sms_api_key: '',
    sms_secret_key: '',
    sms_source_addr: '',
    sms_template: 'Habari [PATIENT_NAME], majibu ya kipimo yako tayari. Tafadhali fika maabara.',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnit, setNewUnit] = useState({ name: '', description: '' });
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSmsSettings();
    loadUnits();
  }, []);

  const loadSettings = async () => {
    try {
      const [keyValueData, signatureData] = await Promise.all([
        supabase
          .from('settings')
          .select('key, value'),
        supabase
          .from('settings')
          .select('signature_image')
          .not('signature_image', 'is', null)
          .limit(1)
          .maybeSingle()
      ]);

      if (keyValueData.error) throw keyValueData.error;

      const settingsMap: any = {};

      if (keyValueData.data) {
        keyValueData.data.forEach((item) => {
          settingsMap[item.key] = item.value;
        });
      }

      setSettings({
        clinic_name: settingsMap.clinic_name || 'Remtullah Medical Laboratory',
        clinic_address: settingsMap.clinic_address || '',
        clinic_phone: settingsMap.clinic_phone || '',
        clinic_email: settingsMap.clinic_email || '',
        clinic_logo_url: settingsMap.clinic_logo_url || '/20260201_200954.jpg',
        clinic_website: settingsMap.clinic_website || '',
        currency: settingsMap.currency || 'TSh',
        signature_image: signatureData.data?.signature_image || '',
      });
    } catch (error: any) {
      console.error('Error loading settings:', error);
      alert(`Failed to load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSmsSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('facility_settings')
        .select('sms_enabled, sms_api_key, sms_secret_key, sms_source_addr, sms_template')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSmsSettings({
          sms_enabled: data.sms_enabled || false,
          sms_api_key: data.sms_api_key || '',
          sms_secret_key: data.sms_secret_key || '',
          sms_source_addr: data.sms_source_addr || '',
          sms_template: data.sms_template || 'Habari [PATIENT_NAME], majibu ya kipimo yako tayari. Tafadhali fika maabara.',
        });
      }
    } catch (error: any) {
      console.error('Error loading SMS settings:', error);
    }
  };

  const handleSaveSms = async () => {
    if (profile?.role !== 'admin') {
      alert('Only administrators can update SMS settings');
      return;
    }

    setSavingSms(true);
    try {
      const { data: existingSettings } = await supabase
        .from('facility_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existingSettings) {
        const { error } = await supabase
          .from('facility_settings')
          .update({
            sms_enabled: smsSettings.sms_enabled,
            sms_api_key: smsSettings.sms_api_key,
            sms_secret_key: smsSettings.sms_secret_key,
            sms_source_addr: smsSettings.sms_source_addr,
            sms_template: smsSettings.sms_template,
          })
          .eq('id', existingSettings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('facility_settings')
          .insert({
            sms_enabled: smsSettings.sms_enabled,
            sms_api_key: smsSettings.sms_api_key,
            sms_secret_key: smsSettings.sms_secret_key,
            sms_source_addr: smsSettings.sms_source_addr,
            sms_template: smsSettings.sms_template,
          });

        if (error) throw error;
      }

      alert('SMS settings saved successfully');
    } catch (error: any) {
      console.error('Error saving SMS settings:', error);
      alert(`Failed to save SMS settings: ${error.message}`);
    } finally {
      setSavingSms(false);
    }
  };

  const handleSave = async () => {
    if (profile?.role !== 'admin') {
      alert('Only administrators can update settings');
      return;
    }

    setSaving(true);
    try {
      const { signature_image, ...keyValueSettings } = settings;

      const settingsArray = Object.entries(keyValueSettings).map(([key, value]) => ({
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

      const { data: existingRow } = await supabase
        .from('settings')
        .select('id, signature_image')
        .not('signature_image', 'is', null)
        .limit(1)
        .maybeSingle();

      if (existingRow) {
        const { error } = await supabase
          .from('settings')
          .update({ signature_image: signature_image || null })
          .eq('id', existingRow.id);

        if (error) throw error;
      } else if (signature_image) {
        const { data: anyRow } = await supabase
          .from('settings')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (anyRow) {
          const { error } = await supabase
            .from('settings')
            .update({ signature_image: signature_image })
            .eq('id', anyRow.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('settings')
            .insert({ key: 'signature_placeholder', value: '', signature_image: signature_image });

          if (error) throw error;
        }
      } else if (!signature_image && existingRow) {
        const { error } = await supabase
          .from('settings')
          .update({ signature_image: null })
          .eq('id', existingRow.id);

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

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setUploadingSignature(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;
        setSettings((prev) => ({ ...prev, signature_image: base64String }));
        setUploadingSignature(false);
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setUploadingSignature(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error uploading signature:', error);
      alert(`Failed to upload signature: ${error.message}`);
      setUploadingSignature(false);
    }
  };

  const handleRemoveSignature = () => {
    if (!confirm('Are you sure you want to remove the signature?')) {
      return;
    }
    setSettings((prev) => ({ ...prev, signature_image: '' }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;
        setSettings((prev) => ({ ...prev, clinic_logo_url: base64String }));
        setUploadingLogo(false);
      };
      reader.onerror = () => {
        alert('Failed to read file');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      alert(`Failed to upload logo: ${error.message}`);
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    if (!confirm('Are you sure you want to remove the logo?')) {
      return;
    }
    setSettings((prev) => ({ ...prev, clinic_logo_url: '' }));
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
                  Clinic Logo
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Upload a logo image or enter a URL to be displayed on receipts and reports
                </p>
                <div className="space-y-4">
                  {settings.clinic_logo_url ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700 mb-2">Current Logo</p>
                          <div className="bg-white border border-gray-300 rounded-lg p-4 inline-block">
                            <img
                              src={settings.clinic_logo_url}
                              alt="Clinic Logo"
                              className="max-h-24 max-w-xs object-contain"
                              onError={(e) => {
                                e.currentTarget.src = '/20260201_200954.jpg';
                              }}
                            />
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={handleRemoveLogo}
                            className="ml-4 text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No logo uploaded</p>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="space-y-3">
                      <label className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingLogo ? 'Uploading...' : settings.clinic_logo_url ? 'Change Logo' : 'Upload Logo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500">
                        Supported formats: PNG, JPG, GIF. Maximum size: 2MB
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          After uploading, click the "Save Changes" button at the top to save your logo.
                        </p>
                      </div>
                      <details className="mt-3">
                        <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                          Or enter a logo URL manually
                        </summary>
                        <div className="mt-3">
                          <input
                            type="text"
                            value={settings.clinic_logo_url}
                            onChange={(e) => handleChange('clinic_logo_url', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., /logo.png or https://example.com/logo.png"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter the path or URL to your logo image
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {!isAdmin && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Only administrators can upload or change the logo.
                      </p>
                    </div>
                  )}
                </div>
              </div>
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
            <div className="flex items-center space-x-2 mb-4">
              <FileSignature className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Signature</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Upload a signature image to be displayed on lab reports and receipts
            </p>
            <div className="space-y-4">
              {settings.signature_image ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-2">Current Signature</p>
                      <div className="bg-white border border-gray-300 rounded-lg p-4 inline-block">
                        <img
                          src={settings.signature_image}
                          alt="Signature"
                          className="max-h-24 max-w-xs object-contain"
                        />
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={handleRemoveSignature}
                        className="ml-4 text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FileSignature className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No signature uploaded</p>
                </div>
              )}

              {isAdmin && (
                <div className="space-y-3">
                  <label className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingSignature ? 'Uploading...' : settings.signature_image ? 'Change Signature' : 'Upload Signature'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      disabled={uploadingSignature}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    Supported formats: PNG, JPG, GIF. Maximum size: 2MB
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      After uploading, click the "Save Changes" button at the top to save your signature.
                    </p>
                  </div>
                </div>
              )}

              {!isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Only administrators can upload or change the signature.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">SMS Notifications</h2>
              </div>
              {isAdmin && (
                <button
                  onClick={handleSaveSms}
                  disabled={savingSms}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingSms ? 'Saving...' : 'Save SMS Settings'}
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Configure SMS notifications to alert patients when their lab results are ready (via Beem Africa)
            </p>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sms_enabled"
                  checked={smsSettings.sms_enabled}
                  onChange={(e) => setSmsSettings({ ...smsSettings, sms_enabled: e.target.checked })}
                  disabled={!isAdmin}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-100"
                />
                <label htmlFor="sms_enabled" className="ml-2 block text-sm font-medium text-gray-700">
                  Enable SMS Notifications
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={smsSettings.sms_api_key}
                  onChange={(e) => setSmsSettings({ ...smsSettings, sms_api_key: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm"
                  placeholder="Enter Beem Africa API Key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret Key
                </label>
                <input
                  type="password"
                  value={smsSettings.sms_secret_key}
                  onChange={(e) => setSmsSettings({ ...smsSettings, sms_secret_key: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm"
                  placeholder="Enter Beem Africa Secret Key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Address (Sender ID)
                </label>
                <input
                  type="text"
                  value={smsSettings.sms_source_addr}
                  onChange={(e) => setSmsSettings({ ...smsSettings, sms_source_addr: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="e.g., CLINIC"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The sender name that will appear to recipients
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMS Message Template
                </label>
                <textarea
                  value={smsSettings.sms_template}
                  onChange={(e) => setSmsSettings({ ...smsSettings, sms_template: e.target.value })}
                  disabled={!isAdmin}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="Enter SMS message template"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: [PATIENT_NAME], [TEST_NAME]
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">How it works:</p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Lab technician enters test results and marks as completed</li>
                  <li>System automatically sends SMS to patient's phone number</li>
                  <li>Patient receives notification that results are ready</li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-900 mb-1">Important Notes:</p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Patient phone numbers must start with 255 (Tanzania)</li>
                  <li>SMS credits must be purchased from Beem Africa</li>
                  <li>Get your API credentials from <a href="https://beem.africa" target="_blank" rel="noopener noreferrer" className="underline font-medium">beem.africa</a></li>
                </ul>
              </div>

              {!isAdmin && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Only administrators can modify SMS notification settings.
                  </p>
                </div>
              )}
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

      {isAdmin && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
          <InterpretationRulesManager />
        </div>
      )}

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
