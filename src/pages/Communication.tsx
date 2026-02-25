import { useState, useEffect } from 'react';
import { MessageSquare, Send, History, FileText, Search, Filter, X, AlertCircle, CheckCircle, Clock, Plus, Edit2, Trash2, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/dateFormat';

type TabType = 'send' | 'history' | 'templates';

type RecipientType = 'single_patient' | 'multiple_patients' | 'all_patients' | 'single_user' | 'all_users' | 'custom';

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface User {
  id: string;
  full_name: string;
  phone: string;
  role: string;
}

interface SmsLog {
  id: string;
  recipient_type: string;
  phone_number: string;
  message: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  sent_by: string;
  users: {
    full_name: string;
  };
}

interface SmsTemplate {
  id: string;
  name: string;
  category: string;
  message_template: string;
  placeholders: string[];
  usage_count: number;
  created_at: string;
}

export default function Communication() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('send');
  const [loading, setLoading] = useState(false);
  const [smsConfigured, setSmsConfigured] = useState(false);

  const [recipientType, setRecipientType] = useState<RecipientType>('single_patient');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [customPhones, setCustomPhones] = useState<string>('');
  const [message, setMessage] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchPatient, setSearchPatient] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [sending, setSending] = useState(false);

  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SmsLog[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchLog, setSearchLog] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'general',
    message_template: '',
  });

  useEffect(() => {
    checkSmsConfiguration();
    if (activeTab === 'send') {
      loadPatients();
      loadUsers();
      loadTemplates();
    } else if (activeTab === 'history') {
      loadSmsLogs();
    } else if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);

  useEffect(() => {
    filterLogs();
  }, [smsLogs, filterStatus, filterType, searchLog]);

  const checkSmsConfiguration = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['sms_enabled', 'sms_api_key', 'sms_secret_key'])
        .maybeSingle();

      if (data) {
        setSmsConfigured(true);
      }
    } catch (error) {
      console.error('Error checking SMS config:', error);
    }
  };

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone')
        .not('phone', 'is', null)
        .order('name');

      if (error) throw error;
      setPatients(data || []);
    } catch (error: any) {
      console.error('Error loading patients:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, role')
        .not('phone', 'is', null)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const loadSmsLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select(`
          *,
          users:sent_by (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setSmsLogs(data || []);
    } catch (error: any) {
      console.error('Error loading SMS logs:', error);
      alert(`Failed to load SMS history: ${error.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...smsLogs];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => log.status === filterStatus);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.recipient_type === filterType);
    }

    if (searchLog) {
      const search = searchLog.toLowerCase();
      filtered = filtered.filter(log =>
        log.phone_number.includes(search) ||
        log.message.toLowerCase().includes(search)
      );
    }

    setFilteredLogs(filtered);
  };

  const getRecipients = () => {
    const recipients: { type: string; id?: string; phone: string; name?: string }[] = [];

    switch (recipientType) {
      case 'single_patient':
        if (selectedPatients.length > 0) {
          const patient = patients.find(p => p.id === selectedPatients[0]);
          if (patient) {
            recipients.push({ type: 'patient', id: patient.id, phone: patient.phone, name: patient.name });
          }
        }
        break;

      case 'multiple_patients':
        selectedPatients.forEach(patientId => {
          const patient = patients.find(p => p.id === patientId);
          if (patient) {
            recipients.push({ type: 'patient', id: patient.id, phone: patient.phone, name: patient.name });
          }
        });
        break;

      case 'all_patients':
        patients.forEach(patient => {
          recipients.push({ type: 'patient', id: patient.id, phone: patient.phone, name: patient.name });
        });
        break;

      case 'single_user':
        if (selectedUsers.length > 0) {
          const user = users.find(u => u.id === selectedUsers[0]);
          if (user) {
            recipients.push({ type: 'user', id: user.id, phone: user.phone, name: user.full_name });
          }
        }
        break;

      case 'all_users':
        users.forEach(user => {
          recipients.push({ type: 'user', id: user.id, phone: user.phone, name: user.full_name });
        });
        break;

      case 'custom':
        const phones = customPhones.split(/[,\n]/).map(p => p.trim()).filter(p => p);
        phones.forEach(phone => {
          recipients.push({ type: 'custom', phone });
        });
        break;
    }

    return recipients;
  };

  const handleSendSms = async () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    const recipients = getRecipients();

    if (recipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    if (recipients.length > 50) {
      if (!confirm(`You are about to send SMS to ${recipients.length} recipients. This may take a while. Continue?`)) {
        return;
      }
    }

    setSending(true);
    try {
      const { data: smsSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['sms_api_key', 'sms_secret_key', 'sms_source_addr']);

      if (!smsSettings || smsSettings.length === 0) {
        throw new Error('SMS credentials not configured');
      }

      const settingsMap: any = {};
      smsSettings.forEach((item: any) => {
        settingsMap[item.key] = item.value;
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`;
      let successCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        try {
          const logData = {
            recipient_type: recipient.type,
            recipient_id: recipient.id || null,
            phone_number: recipient.phone,
            message: message,
            status: 'pending',
            sent_by: profile?.id,
          };

          const { data: log, error: logError } = await supabase
            .from('sms_logs')
            .insert(logData)
            .select()
            .single();

          if (logError) throw logError;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              phone: recipient.phone,
              message: message,
              api_key: settingsMap.sms_api_key,
              secret_key: settingsMap.sms_secret_key,
              source_addr: settingsMap.sms_source_addr,
            }),
          });

          if (response.ok) {
            await supabase
              .from('sms_logs')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', log.id);
            successCount++;
          } else {
            const result = await response.json();
            await supabase
              .from('sms_logs')
              .update({
                status: 'failed',
                error_message: result.error || 'Unknown error'
              })
              .eq('id', log.id);
            failCount++;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error('Error sending SMS:', error);
          failCount++;
        }
      }

      alert(`SMS sending complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);

      setMessage('');
      setSelectedPatients([]);
      setSelectedUsers([]);
      setCustomPhones('');
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      alert(`Failed to send SMS: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.message_template.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('sms_templates')
          .update({
            name: templateForm.name,
            category: templateForm.category,
            message_template: templateForm.message_template,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        alert('Template updated successfully');
      } else {
        const { error } = await supabase
          .from('sms_templates')
          .insert({
            name: templateForm.name,
            category: templateForm.category,
            message_template: templateForm.message_template,
            created_by: profile?.id,
          });

        if (error) throw error;
        alert('Template created successfully');
      }

      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', category: 'general', message_template: '' });
      loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(`Failed to save template: ${error.message}`);
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from('sms_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Template deleted successfully');
      loadTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      alert(`Failed to delete template: ${error.message}`);
    }
  };

  const handleUseTemplate = (template: SmsTemplate) => {
    setMessage(template.message_template);
    setActiveTab('send');

    supabase
      .from('sms_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', template.id)
      .then(() => loadTemplates());
  };

  const insertPlaceholder = (placeholder: string) => {
    setMessage(prev => prev + placeholder);
  };

  const getMessageSegments = (text: string) => {
    return Math.ceil(text.length / 160) || 1;
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">Access Restricted</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Only administrators can access the Communication module.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!smsConfigured) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">SMS Not Configured</h3>
              <p className="text-sm text-blue-800 mt-1">
                Please configure SMS settings before using the Communication module.
              </p>
              <a
                href="#/settings"
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Settings
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
    p.phone.includes(searchPatient)
  );

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.phone.includes(searchUser)
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
              <p className="text-sm text-gray-500">Send SMS messages to patients and users</p>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('send')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'send'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Send className="w-4 h-4" />
                <span>Send SMS</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4" />
                <span>History</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Templates</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'send' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Recipients
                </label>
                <select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value as RecipientType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="single_patient">Single Patient</option>
                  <option value="multiple_patients">Multiple Patients</option>
                  <option value="all_patients">All Patients</option>
                  <option value="single_user">Single User</option>
                  <option value="all_users">All Users</option>
                  <option value="custom">Custom Phone Numbers</option>
                </select>
              </div>

              {(recipientType === 'single_patient' || recipientType === 'multiple_patients') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Patient(s)
                  </label>
                  <input
                    type="text"
                    placeholder="Search patients..."
                    value={searchPatient}
                    onChange={(e) => setSearchPatient(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 mb-2"
                  />
                  <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                    {filteredPatients.map(patient => (
                      <label
                        key={patient.id}
                        className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type={recipientType === 'single_patient' ? 'radio' : 'checkbox'}
                          name="patient"
                          checked={selectedPatients.includes(patient.id)}
                          onChange={() => {
                            if (recipientType === 'single_patient') {
                              setSelectedPatients([patient.id]);
                            } else {
                              setSelectedPatients(prev =>
                                prev.includes(patient.id)
                                  ? prev.filter(id => id !== patient.id)
                                  : [...prev, patient.id]
                              );
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                          <div className="text-xs text-gray-500">{patient.phone}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {recipientType === 'multiple_patients' && selectedPatients.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedPatients.length} patient(s) selected
                    </p>
                  )}
                </div>
              )}

              {recipientType === 'all_patients' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    SMS will be sent to all {patients.length} patients with phone numbers.
                  </p>
                </div>
              )}

              {(recipientType === 'single_user' || recipientType === 'all_users') && (
                <div>
                  {recipientType === 'single_user' && (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select User
                      </label>
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchUser}
                        onChange={(e) => setSearchUser(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 mb-2"
                      />
                      <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                        {filteredUsers.map(user => (
                          <label
                            key={user.id}
                            className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="user"
                              checked={selectedUsers.includes(user.id)}
                              onChange={() => setSelectedUsers([user.id])}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                              <div className="text-xs text-gray-500">{user.phone} - {user.role}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  {recipientType === 'all_users' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        SMS will be sent to all {users.length} users with phone numbers.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {recipientType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Numbers
                  </label>
                  <textarea
                    value={customPhones}
                    onChange={(e) => setCustomPhones(e.target.value)}
                    rows={4}
                    placeholder="Enter phone numbers (one per line or comma-separated)&#10;Example: 0794100044, 0754123456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter phone numbers in Tanzania format (0794100044 or 255794100044)
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Message
                  </label>
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-gray-500">
                      {message.length} chars / {getMessageSegments(message)} SMS
                    </span>
                    {templates.length > 0 && (
                      <select
                        onChange={(e) => {
                          const template = templates.find(t => t.id === e.target.value);
                          if (template) handleUseTemplate(template);
                        }}
                        className="text-xs px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="">Use Template</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Type your message here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => insertPlaceholder('[PATIENT_NAME]')}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    + Patient Name
                  </button>
                  <button
                    onClick={() => insertPlaceholder('[CLINIC_NAME]')}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    + Clinic Name
                  </button>
                </div>
              </div>

              <button
                onClick={handleSendSms}
                disabled={sending}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center justify-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>{sending ? 'Sending...' : 'Send SMS'}</span>
              </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by phone or message..."
                      value={searchLog}
                      onChange={(e) => setSearchLog(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="patient">Patient</option>
                  <option value="user">User</option>
                  <option value="custom">Custom</option>
                </select>
                <button
                  onClick={loadSmsLogs}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Refresh
                </button>
              </div>

              {loadingLogs ? (
                <div className="text-center py-12 text-gray-500">Loading history...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No SMS history found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{log.phone_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {log.recipient_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                            {log.message}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {log.status === 'sent' && (
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Sent
                              </span>
                            )}
                            {log.status === 'failed' && (
                              <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                                <X className="w-3 h-3 mr-1" />
                                Failed
                              </span>
                            )}
                            {log.status === 'pending' && (
                              <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {log.users?.full_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
                <button
                  onClick={() => {
                    setShowTemplateModal(true);
                    setEditingTemplate(null);
                    setTemplateForm({ name: '', category: 'general', message_template: '' });
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Template</span>
                </button>
              </div>

              {loadingTemplates ? (
                <div className="text-center py-12 text-gray-500">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No templates found</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map(template => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{template.name}</h4>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded mt-1 inline-block">
                            {template.category}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUseTemplate(template)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Use template"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTemplate(template);
                              setTemplateForm({
                                name: template.name,
                                category: template.category,
                                message_template: template.message_template,
                              });
                              setShowTemplateModal(true);
                            }}
                            className="text-gray-600 hover:text-gray-800"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.message_template}</p>
                      <div className="text-xs text-gray-500">
                        Used {template.usage_count} times
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Appointment Reminder"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="general">General</option>
                  <option value="marketing">Marketing</option>
                  <option value="notification">Notification</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Template
                </label>
                <textarea
                  value={templateForm.message_template}
                  onChange={(e) => setTemplateForm({ ...templateForm, message_template: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter message template (use [PATIENT_NAME], [CLINIC_NAME] as placeholders)"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingTemplate ? 'Update' : 'Create'} Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
