import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { formatDate, formatTime, formatDateTime } from '../lib/dateFormat';
import { Search, Plus, User, Eye, CreditCard as Edit2, Trash2, FileText, Pill, X, Printer, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react';
import Pagination from '../components/Pagination';

interface Patient {
  id: string;
  name: string;
  phone: string;
  gender: string;
  dob: string | null;
  age: number | null;
  age_unit: string | null;
  address: string;
  marital_status: string | null;
  created_at: string;
}

interface PatientHistory {
  id: string;
  created_at: string;
  diagnosis: string;
  total: number;
  payment_status: string;
  doctor_name: string;
}

interface TestResultHistory {
  id: string;
  visit_date: string;
  test_name: string;
  status: string;
  result_date: string | null;
  doctor_name: string;
}

interface MedicineHistory {
  id: string;
  visit_date: string;
  medicine_name: string;
  quantity: number;
  unit: string;
  doctor_name: string;
  diagnosis: string;
}

interface TestParameter {
  id: string;
  parameter_name: string;
  unit: string | null;
  ref_range_from: number | null;
  ref_range_to: number | null;
  applicable_to_male: boolean;
  applicable_to_female: boolean;
  applicable_to_child: boolean;
  sort_order: number;
}

interface TestResult {
  id: string;
  value: string;
  is_abnormal: boolean;
  abnormality_type: 'L' | 'H' | null;
  notes: string | null;
  test_parameter: TestParameter;
}

interface VisitTestInfo {
  id: string;
  visit: {
    id: string;
    created_at: string;
    patient: {
      id: string;
      name: string;
      dob: string;
      age: number | null;
      age_unit: string | null;
      gender: string;
    };
  };
  test: {
    name: string;
  };
  results_status: string;
  results_entered_at: string | null;
  results_entered_by: string | null;
  technician_notes: string | null;
}

interface PatientsProps {
  onStartVisit?: (patientId: string) => void;
  onViewTestResult?: (visitTestId: string) => void;
}

export default function Patients({ onStartVisit, onViewTestResult }: PatientsProps) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<PatientHistory[]>([]);
  const [testResults, setTestResults] = useState<TestResultHistory[]>([]);
  const [medicines, setMedicines] = useState<MedicineHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'visits' | 'tests' | 'medicines'>('visits');
  const [historyPage, setHistoryPage] = useState(1);
  const [testsPage, setTestsPage] = useState(1);
  const [medicinesPage, setMedicinesPage] = useState(1);
  const historyItemsPerPage = 10;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [selectedTestResultId, setSelectedTestResultId] = useState<string | null>(null);
  const [testResultData, setTestResultData] = useState<{
    visitTest: VisitTestInfo | null;
    results: TestResult[];
    settings: any;
    enteredByName: string | null;
    enteredByRole: string | null;
  }>({ visitTest: null, results: [], settings: null, enteredByName: null, enteredByRole: null });
  const [loadingTestResult, setLoadingTestResult] = useState(false);
  const [loadingTestResultId, setLoadingTestResultId] = useState<string | null>(null);
  const [sendingSmsFor, setSendingSmsFor] = useState<string | null>(null);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    dob: '',
    age: '',
    age_unit: 'years',
    address: '',
    marital_status: '',
  });

  function convertDDMMYYYYToYYYYMMDD(date: string): string | null {
    if (!date) return null;
    const parts = date.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (!day || !month || !year || year.length !== 4) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  function convertYYYYMMDDToDDMMYYYY(date: string | null): string {
    if (!date) return '';
    const parts = date.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (submitting) return;

    setShowConfirmDialog(true);
  }

  async function confirmSubmit() {
    if (submitting) return;

    setSubmitting(true);
    setShowConfirmDialog(false);

    try {
      const dobFormatted = convertDDMMYYYYToYYYYMMDD(formData.dob);

      if (editingPatient) {
        const { error } = await supabase
          .from('patients')
          .update({
            name: formData.name,
            phone: formData.phone,
            gender: formData.gender,
            dob: dobFormatted,
            age: formData.age ? parseInt(formData.age) : null,
            age_unit: formData.age ? formData.age_unit : null,
            address: formData.address,
            marital_status: formData.marital_status || null,
          })
          .eq('id', editingPatient.id);

        if (error) throw error;
      } else {
        const { data: newPatient, error } = await supabase.from('patients').insert({
          name: formData.name,
          phone: formData.phone,
          gender: formData.gender,
          dob: dobFormatted,
          age: formData.age ? parseInt(formData.age) : null,
          age_unit: formData.age ? formData.age_unit : null,
          address: formData.address,
          marital_status: formData.marital_status || null,
        }).select().single();

        if (error) throw error;

        if (newPatient) {
          setPatients([newPatient, ...patients]);
        }
      }

      setFormData({ name: '', phone: '', gender: '', dob: '', age: '', age_unit: 'years', address: '', marital_status: '' });
      setEditingPatient(null);
      setShowForm(false);

      if (editingPatient) {
        loadPatients();
      }
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Failed to save patient');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(patient: Patient) {
    if (!confirm(`Delete patient "${patient.name}"? This will also delete all their visit history.`)) return;

    try {
      const { error } = await supabase.from('patients').delete().eq('id', patient.id);

      if (error) throw error;
      loadPatients();
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Failed to delete patient');
    }
  }

  function openEditForm(patient: Patient) {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      phone: patient.phone,
      gender: patient.gender,
      dob: convertYYYYMMDDToDDMMYYYY(patient.dob),
      age: patient.age?.toString() || '',
      age_unit: patient.age_unit || 'years',
      address: patient.address,
      marital_status: patient.marital_status || '',
    });
    setShowForm(true);
  }

  function openAddForm() {
    setEditingPatient(null);
    setFormData({ name: '', phone: '', gender: '', dob: '', age: '', age_unit: 'years', address: '', marital_status: '' });
    setShowForm(true);
  }

  async function viewHistory(patient: Patient) {
    setSelectedPatient(patient);
    setShowHistory(true);

    try {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          id,
          created_at,
          diagnosis,
          total,
          payment_status,
          users!visits_doctor_id_fkey(name)
        `)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const historyData = data.map((v: any) => ({
        id: v.id,
        created_at: v.created_at,
        diagnosis: v.diagnosis,
        total: v.total,
        payment_status: v.payment_status,
        doctor_name: v.users?.name || 'Unknown',
      }));

      setHistory(historyData);

      const { data: visitsWithTests, error: testsError } = await supabase
        .from('visits')
        .select(`
          created_at,
          users!visits_doctor_id_fkey(name),
          visit_tests(
            id,
            results_status,
            results_entered_at,
            tests(name)
          )
        `)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (testsError) throw testsError;

      const testResultsData: TestResultHistory[] = [];
      visitsWithTests?.forEach((visit: any) => {
        visit.visit_tests?.forEach((test: any) => {
          testResultsData.push({
            id: test.id,
            visit_date: visit.created_at,
            test_name: test.tests?.name || 'Unknown',
            status: test.results_status,
            result_date: test.results_entered_at,
            doctor_name: visit.users?.name || 'Unknown',
          });
        });
      });

      setTestResults(testResultsData);

      if (profile?.role === 'admin') {
        const { data: visitsWithMedicines, error: medicinesError } = await supabase
          .from('visits')
          .select(`
            created_at,
            diagnosis,
            users!visits_doctor_id_fkey(name),
            visit_medicines(
              id,
              qty,
              unit,
              inventory_items(name)
            )
          `)
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false });

        if (medicinesError) throw medicinesError;

        const medicinesHistoryData: MedicineHistory[] = [];
        visitsWithMedicines?.forEach((visit: any) => {
          visit.visit_medicines?.forEach((medicine: any) => {
            medicinesHistoryData.push({
              id: medicine.id,
              visit_date: visit.created_at,
              medicine_name: medicine.inventory_items?.name || 'Unknown',
              quantity: medicine.qty,
              unit: medicine.unit,
              doctor_name: visit.users?.name || 'Unknown',
              diagnosis: visit.diagnosis || '',
            });
          });
        });

        setMedicines(medicinesHistoryData);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  async function handleDeleteVisit(visitId: string) {
    if (!confirm('Delete this visit? This action cannot be undone.')) return;

    try {
      const { error } = await supabase.from('visits').delete().eq('id', visitId);

      if (error) throw error;

      if (selectedPatient) {
        viewHistory(selectedPatient);
      }
    } catch (error) {
      console.error('Error deleting visit:', error);
      alert('Failed to delete visit');
    }
  }

  async function handleViewTestResult(visitTestId: string) {
    setSelectedTestResultId(visitTestId);
    setLoadingTestResultId(visitTestId);
    setShowTestResultModal(true);
    setLoadingTestResult(true);

    try {
      // Fetch visit test data first to get results_entered_by
      const visitTestData = await supabase
        .from('visit_tests')
        .select(`
          id,
          results_status,
          results_entered_at,
          results_entered_by,
          technician_notes,
          visit:visits (
            id,
            created_at,
            patient:patients (
              id,
              name,
              dob,
              age,
              age_unit,
              gender
            )
          ),
          test:tests (
            name
          )
        `)
        .eq('id', visitTestId)
        .maybeSingle();

      if (visitTestData.error) throw visitTestData.error;
      if (!visitTestData.data) throw new Error('Test result not found');

      // Now fetch everything else in parallel, including user data if needed
      const promises = [
        supabase
          .from('visit_test_results')
          .select(`
            id,
            value,
            is_abnormal,
            abnormality_type,
            notes,
            test_parameter:test_parameters (
              id,
              parameter_name,
              unit,
              ref_range_from,
              ref_range_to,
              applicable_to_male,
              applicable_to_female,
              applicable_to_child,
              sort_order
            )
          `)
          .eq('visit_test_id', visitTestId),
        supabase
          .from('settings')
          .select('key, value'),
        supabase
          .from('settings')
          .select('signature_image')
          .not('signature_image', 'is', null)
          .limit(1)
          .maybeSingle()
      ];

      // Add user query if results_entered_by exists
      if (visitTestData.data.results_entered_by) {
        promises.push(
          supabase
            .from('users')
            .select('name, role')
            .eq('id', visitTestData.data.results_entered_by)
            .maybeSingle()
        );
      }

      const results = await Promise.all(promises);
      const resultsData = results[0];
      const keyValueData = results[1];
      const signatureData = results[2];
      const userData = results[3];

      const sortedResults = resultsData.data
        ? (resultsData.data as any).sort(
            (a: TestResult, b: TestResult) =>
              a.test_parameter.sort_order - b.test_parameter.sort_order
          )
        : [];

      let settingsMap: any = {};
      if (keyValueData.data) {
        keyValueData.data.forEach((item: any) => {
          settingsMap[item.key] = item.value;
        });
      }

      if (signatureData.data?.signature_image) {
        settingsMap.signature_image = signatureData.data.signature_image;
      }

      let enteredByName = null;
      let enteredByRole = null;
      if (userData?.data) {
        enteredByName = userData.data.name;
        enteredByRole = userData.data.role;
      }

      setTestResultData({
        visitTest: visitTestData.data as any,
        results: sortedResults,
        settings: settingsMap,
        enteredByName,
        enteredByRole,
      });
    } catch (error: any) {
      console.error('Error loading test results:', error);
      alert(`Failed to load test results: ${error.message || 'Unknown error'}`);
      setShowTestResultModal(false);
    } finally {
      setLoadingTestResult(false);
      setLoadingTestResultId(null);
    }
  }

  function handlePrintTestResult() {
    window.print();
  }

  const handleSendSMS = async (patient: Patient) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'doctor')) {
      alert('Only administrators and doctors can send SMS');
      return;
    }

    if (!patient.phone) {
      alert('Patient has no phone number');
      return;
    }

    try {
      const { data: completedTests, error: testsError } = await supabase
        .from('visit_tests')
        .select(`
          id,
          visit:visits!inner (
            patient_id
          )
        `)
        .eq('visit.patient_id', patient.id)
        .eq('results_status', 'completed');

      if (testsError) {
        console.error('Error fetching tests:', testsError);
        alert('Failed to check for completed tests');
        return;
      }

      if (!completedTests || completedTests.length === 0) {
        alert('This patient has no completed test results');
        return;
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['sms_completion_message']);

      const settingsMap: Record<string, string> = {};
      if (settings) {
        settings.forEach((s: any) => {
          settingsMap[s.key] = s.value;
        });
      }

      const messageTemplate = settingsMap.sms_completion_message || 'Hello {patient_name}, your test results are ready. Please visit the clinic.';
      const previewMessage = messageTemplate.replace(/{patient_name}/g, patient.name);

      const confirmSend = confirm(
        `Send SMS to ${patient.name}?\n\nPhone: ${patient.phone}\n\nMessage: "${previewMessage}"`
      );
      if (!confirmSend) return;

      setSendingSmsFor(patient.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-lab-result-sms`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visit_test_id: completedTests[0].id,
        }),
      });

      const result = await response.json();

      console.log('SMS Response:', { status: response.status, result });

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send SMS');
      }

      alert('SMS sent successfully!');
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      alert(`Failed to send SMS: ${error.message || 'Unknown error'}`);
    } finally {
      setSendingSmsFor(null);
    }
  };

  function calculateAgeFromDOB(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone.includes(searchTerm)
  );

  const totalItems = filteredPatients.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
        <button
          onClick={openAddForm}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          <span>Add Patient</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Gender
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Age
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedPatients.map((patient) => (
              <tr key={patient.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">{patient.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{patient.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{patient.gender}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                  {patient.age
                    ? `${patient.age} ${patient.age_unit || 'years'}`
                    : (patient.dob ? calculateAge(patient.dob).display : 'N/A')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => viewHistory(patient)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View History"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {(profile?.role === 'admin' || profile?.role === 'doctor') && patient.phone && (
                      <button
                        onClick={() => handleSendSMS(patient)}
                        disabled={sendingSmsFor === patient.id}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        title="Send SMS to Patient"
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        {sendingSmsFor === patient.id ? 'Sending...' : 'Send SMS'}
                      </button>
                    )}
                    {profile?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => openEditForm(patient)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Patient"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(patient)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Patient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {onStartVisit && (
                      <button
                        onClick={() => onStartVisit(patient.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                      >
                        Visit
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPatients.length === 0 && (
          <div className="text-center py-12 text-gray-500">No patients found</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingPatient ? 'Edit Patient' : 'Add New Patient'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                <select
                  value={formData.marital_status}
                  onChange={(e) => setFormData({ ...formData, marital_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth (DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    pattern="\d{2}/\d{2}/\d{4}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter age"
                    />
                    <select
                      value={formData.age_unit}
                      onChange={(e) => setFormData({ ...formData, age_unit: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="years">Years</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">For infants under 1 year, select "Months"</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPatient(null);
                    setSubmitting(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingPatient ? 'Update Patient' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Confirm Patient Information</h3>
            <div className="mb-6 space-y-2">
              <p className="text-gray-700">
                Please confirm you want to {editingPatient ? 'update' : 'create'} this patient:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {formData.name}</p>
                {formData.phone && <p><span className="font-medium">Phone:</span> {formData.phone}</p>}
                {formData.gender && <p><span className="font-medium">Gender:</span> {formData.gender}</p>}
                {formData.age && <p><span className="font-medium">Age:</span> {formData.age}</p>}
                {formData.marital_status && <p><span className="font-medium">Marital Status:</span> {formData.marital_status}</p>}
                {formData.address && <p><span className="font-medium">Address:</span> {formData.address}</p>}
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Patient Profile</h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Name</p>
                    <p className="font-bold text-gray-900">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Phone</p>
                    <p className="text-gray-900">{selectedPatient.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Gender</p>
                    <p className="text-gray-900">{selectedPatient.gender}</p>
                  </div>
                  {selectedPatient.dob && (
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Date of Birth</p>
                      <p className="text-gray-900">{formatDate(selectedPatient.dob)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Age</p>
                    <p className="text-gray-900">
                      {selectedPatient.age != null
                        ? `${selectedPatient.age} ${selectedPatient.age_unit || 'years'}`
                        : (selectedPatient.dob ? calculateAge(selectedPatient.dob).display : 'N/A')}
                    </p>
                  </div>
                  {(profile?.role === 'admin' || profile?.role === 'doctor') && selectedPatient.marital_status && (
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Marital Status</p>
                      <p className="text-gray-900">{selectedPatient.marital_status}</p>
                    </div>
                  )}
                  {selectedPatient.address && (
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Address</p>
                      <p className="text-gray-900">{selectedPatient.address}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-1 mt-4 border-b border-gray-200">
                <button
                  onClick={() => {
                    setActiveTab('visits');
                    setHistoryPage(1);
                  }}
                  className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                    activeTab === 'visits'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Visits ({history.length})</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('tests');
                    setTestsPage(1);
                  }}
                  className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                    activeTab === 'tests'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Test Results ({testResults.length})</span>
                  </div>
                </button>
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setActiveTab('medicines');
                      setMedicinesPage(1);
                    }}
                    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
                      activeTab === 'medicines'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Pill className="w-4 h-4" />
                      <span>Medicines ({medicines.length})</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'visits' && (
                <div>
                  {history.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No visit history found</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {history
                          .slice(
                            (historyPage - 1) * historyItemsPerPage,
                            historyPage * historyItemsPerPage
                          )
                          .map((visit) => (
                            <div key={visit.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                      <FileText className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-900">
                                        {formatDate(visit.created_at)} at {formatTime(visit.created_at)}
                                      </p>
                                      <p className="text-sm text-gray-600">Doctor: {visit.doctor_name}</p>
                                    </div>
                                  </div>
                                  {visit.diagnosis && (
                                    <div className="ml-11 bg-blue-50 rounded p-2 border-l-4 border-blue-600">
                                      <p className="text-sm text-gray-700">
                                        <span className="font-semibold">Diagnosis:</span> {visit.diagnosis}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-start space-x-3 ml-4">
                                  <div className="text-right">
                                    <p className="font-bold text-lg text-gray-900">{formatCurrency(visit.total)}</p>
                                    <span
                                      className={`text-xs px-2 py-1 rounded font-semibold ${
                                        visit.payment_status === 'paid'
                                          ? 'bg-green-100 text-green-800'
                                          : visit.payment_status === 'partial'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {visit.payment_status.toUpperCase()}
                                    </span>
                                  </div>
                                  {profile?.role === 'admin' && (
                                    <button
                                      onClick={() => handleDeleteVisit(visit.id)}
                                      className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition-colors"
                                      title="Delete Visit"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      {history.length > historyItemsPerPage && (
                        <div className="mt-6">
                          <Pagination
                            currentPage={historyPage}
                            totalItems={history.length}
                            itemsPerPage={historyItemsPerPage}
                            onPageChange={setHistoryPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'tests' && (
                <div>
                  {testResults.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No test results found</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {testResults
                          .slice(
                            (testsPage - 1) * historyItemsPerPage,
                            testsPage * historyItemsPerPage
                          )
                          .map((test) => (
                            <div key={test.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-start space-x-3 flex-1">
                                  <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
                                    <FileText className="w-4 h-4 text-green-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-base">{test.test_name}</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      Visit: {formatDate(test.visit_date)} at {formatTime(test.visit_date)}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs px-2 py-1 rounded font-semibold flex-shrink-0 ml-2 ${
                                    test.status === 'completed'
                                      ? 'bg-green-100 text-green-800'
                                      : test.status === 'in_progress'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {test.status.toUpperCase().replace('_', ' ')}
                                </span>
                              </div>
                              {test.result_date && (
                                <div className="ml-11 mb-2">
                                  <p className="text-xs text-gray-600">
                                    <span className="font-semibold">Result Date:</span> {formatDate(test.result_date)} at {formatTime(test.result_date)}
                                  </p>
                                </div>
                              )}
                              <div className="ml-11">
                                <p className="text-xs text-gray-600 mb-2">
                                  <span className="font-semibold">Doctor:</span> {test.doctor_name}
                                </p>
                                <button
                                  onClick={() => handleViewTestResult(test.id)}
                                  disabled={loadingTestResultId === test.id}
                                  className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${
                                    loadingTestResultId === test.id
                                      ? 'bg-gray-400 text-white cursor-not-allowed'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {loadingTestResultId === test.id ? 'Loading...' : 'View Full Result'}
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                      {testResults.length > historyItemsPerPage && (
                        <div className="mt-6">
                          <Pagination
                            currentPage={testsPage}
                            totalItems={testResults.length}
                            itemsPerPage={historyItemsPerPage}
                            onPageChange={setTestsPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'medicines' && profile?.role === 'admin' && (
                <div>
                  {medicines.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg">
                      <Pill className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">No dispensed medicines found</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Medicine
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Quantity
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Doctor
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {medicines
                                .slice(
                                  (medicinesPage - 1) * historyItemsPerPage,
                                  medicinesPage * historyItemsPerPage
                                )
                                .map((medicine, index) => (
                                  <tr key={medicine.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                      {formatDate(medicine.visit_date)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                      {medicine.medicine_name}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                                        {medicine.quantity} {medicine.unit}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                      {medicine.doctor_name}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {medicines.length > historyItemsPerPage && (
                        <div className="mt-6">
                          <Pagination
                            currentPage={medicinesPage}
                            totalItems={medicines.length}
                            itemsPerPage={historyItemsPerPage}
                            onPageChange={setMedicinesPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTestResultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 no-print">
              <h2 className="text-xl font-bold text-gray-900">Test Results</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintTestResult}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Print
                </button>
                <button
                  onClick={() => setShowTestResultModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6" id="print-root">
              {loadingTestResult ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-gray-500">Loading test results...</div>
                </div>
              ) : testResultData.visitTest ? (
                <div>
                  <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {testResultData.settings?.clinic_logo_url && (
                            <div className="bg-white rounded-lg p-2 shadow-md">
                              <img
                                src={testResultData.settings.clinic_logo_url}
                                alt={testResultData.settings?.clinic_name || 'Medical Laboratory'}
                                className="h-16 w-auto object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="text-left">
                            <h1 className="text-2xl font-bold tracking-tight">
                              {testResultData.settings?.clinic_name || 'Remtullah Medical Laboratory'}
                            </h1>
                            {testResultData.settings?.clinic_address && (
                              <p className="text-blue-100 text-sm mt-1">{testResultData.settings.clinic_address}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm space-y-1">
                          {testResultData.settings?.clinic_phone && (
                            <p className="text-blue-100">Tel: {testResultData.settings.clinic_phone}</p>
                          )}
                          {testResultData.settings?.clinic_email && (
                            <p className="text-blue-100">Email: {testResultData.settings.clinic_email}</p>
                          )}
                          {testResultData.settings?.clinic_website && (
                            <p className="text-blue-100">{testResultData.settings.clinic_website}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-6 text-center">
                        <div className="inline-block bg-white text-blue-700 px-6 py-2 rounded-full shadow-md">
                          <h2 className="text-lg font-bold tracking-wide">LABORATORY TEST REPORT</h2>
                        </div>
                      </div>
                    </div>

                    <div className="px-8 py-6">
                      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-100 no-break">
                        <div className="flex items-center mb-4">
                          <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider">
                            Patient Information
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Patient Name</span>
                                <span className="text-base font-bold text-gray-900">
                                  {testResultData.visitTest.visit.patient.name}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Patient ID</span>
                                <span className="text-gray-900 font-mono font-semibold">
                                  {testResultData.visitTest.visit.patient.id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Date of Birth</span>
                                <span className="text-gray-900 font-semibold">
                                  {testResultData.visitTest.visit.patient.dob ? formatDate(testResultData.visitTest.visit.patient.dob) : 'N/A'}
                                  {testResultData.visitTest.visit.patient.age && (
                                    <span> ({testResultData.visitTest.visit.patient.age} {testResultData.visitTest.visit.patient.age_unit || 'years'})</span>
                                  )}
                                  {!testResultData.visitTest.visit.patient.age && testResultData.visitTest.visit.patient.dob && (
                                    <span> ({calculateAge(testResultData.visitTest.visit.patient.dob).display})</span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Gender</span>
                                <span className="text-gray-900 font-semibold capitalize">
                                  {testResultData.visitTest.visit.patient.gender}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Visit ID</span>
                                <span className="text-gray-900 font-mono font-semibold">
                                  #{testResultData.visitTest.visit.id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Visit Date</span>
                                <span className="text-gray-900 font-semibold">
                                  {formatDate(testResultData.visitTest.visit.created_at)}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Test Name</span>
                                <span className="text-base font-bold text-gray-900">{testResultData.visitTest.test.name}</span>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Report Date</span>
                                <span className="text-gray-900 font-semibold">
                                  {testResultData.visitTest.results_entered_at
                                    ? formatDate(testResultData.visitTest.results_entered_at)
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mb-6 no-break">
                        <div className="flex items-center mb-4">
                          <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider">
                            Test Results
                          </div>
                        </div>
                        {testResultData.results.length === 0 ? (
                          <div className="text-center py-16 text-gray-500 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-gray-300">
                            <p className="text-lg font-medium">No results have been entered for this test yet.</p>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-xl border-2 border-blue-100 shadow-md">
                            <table className="min-w-full">
                              <thead>
                                <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                  <th className="text-left py-4 px-5 font-bold text-sm tracking-wider">PARAMETER</th>
                                  <th className="text-left py-4 px-5 font-bold text-sm tracking-wider">RESULT</th>
                                  <th className="text-left py-4 px-5 font-bold text-sm tracking-wider">UNIT</th>
                                  <th className="text-left py-4 px-5 font-bold text-sm tracking-wider">REFERENCE RANGE</th>
                                  <th className="text-center py-4 px-5 font-bold text-sm tracking-wider">STATUS</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                {testResultData.results.map((result, index) => (
                                  <tr
                                    key={result.id}
                                    className={`border-b border-gray-200 transition-colors ${
                                      result.is_abnormal ? 'bg-red-50 hover:bg-red-100' : index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
                                    }`}
                                  >
                                    <td className="py-4 px-5 text-sm">
                                      <div className="font-bold text-gray-900">{result.test_parameter.parameter_name}</div>
                                      {(result.test_parameter.applicable_to_male || result.test_parameter.applicable_to_female || result.test_parameter.applicable_to_child) && (
                                        <div className="flex gap-1 mt-1">
                                          {result.test_parameter.applicable_to_male && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">Male</span>
                                          )}
                                          {result.test_parameter.applicable_to_female && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-semibold">Female</span>
                                          )}
                                          {result.test_parameter.applicable_to_child && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Child</span>
                                          )}
                                        </div>
                                      )}
                                      {result.notes && (
                                        <div className="text-xs text-gray-600 mt-1 italic bg-yellow-50 border-l-2 border-yellow-400 pl-2 py-1">{result.notes}</div>
                                      )}
                                    </td>
                                    <td className={`py-4 px-5 text-lg font-bold ${
                                      result.is_abnormal ? 'text-red-700' : 'text-gray-900'
                                    }`}>
                                      {result.value}
                                    </td>
                                    <td className="py-4 px-5 text-sm font-medium text-gray-600">
                                      {result.test_parameter.unit || '-'}
                                    </td>
                                    <td className="py-4 px-5 text-sm font-medium text-gray-600">
                                      {result.test_parameter.ref_range_from !== null && result.test_parameter.ref_range_to !== null
                                        ? `${result.test_parameter.ref_range_from} - ${result.test_parameter.ref_range_to}`
                                        : result.test_parameter.ref_range_from !== null
                                          ? `${result.test_parameter.ref_range_from}+`
                                          : result.test_parameter.ref_range_to !== null
                                            ? `< ${result.test_parameter.ref_range_to}`
                                            : '-'}
                                    </td>
                                    <td className="py-4 px-5 text-sm text-center">
                                      {result.test_parameter.ref_range_from !== null || result.test_parameter.ref_range_to !== null ? (
                                        result.is_abnormal ? (
                                          result.abnormality_type === 'L' ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-md">
                                              <TrendingDown className="w-3.5 h-3.5" />
                                              LOW (L)
                                            </span>
                                          ) : result.abnormality_type === 'H' ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs shadow-md">
                                              <TrendingUp className="w-3.5 h-3.5" />
                                              HIGH (H)
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs shadow-md">
                                              ABNORMAL
                                            </span>
                                          )
                                        ) : (
                                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs shadow-md">
                                            NORMAL
                                          </span>
                                        )
                                      ) : (
                                        result.is_abnormal ? (
                                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs shadow-md">
                                            ABNORMAL
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs shadow-md">
                                            NORMAL
                                          </span>
                                        )
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {testResultData.visitTest.technician_notes && (
                        <div className="mb-6 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 shadow-sm">
                          <div className="flex items-center mb-3">
                            <div className="bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                              Technician Notes
                            </div>
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed font-medium">{testResultData.visitTest.technician_notes}</p>
                        </div>
                      )}

                      <div className="mt-8 pt-6 border-t-2 border-blue-200 no-break">
                        <div className="grid grid-cols-2 gap-6 text-sm">
                          <div className="space-y-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200 shadow-sm">
                              <p className="text-xs uppercase tracking-wider text-blue-700 font-bold mb-2">
                                Results Entered By
                              </p>
                              <p className="font-bold text-gray-900 text-base">
                                {testResultData.enteredByName || 'N/A'}
                              </p>
                              {testResultData.enteredByRole && (
                                <p className="text-xs text-blue-600 mt-1 capitalize font-semibold">
                                  {testResultData.enteredByRole.replace('_', ' ')}
                                </p>
                              )}
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200 shadow-sm">
                              <p className="text-xs uppercase tracking-wider text-blue-700 font-bold mb-2">
                                Report Date & Time
                              </p>
                              <p className="font-bold text-gray-900 text-base">
                                {testResultData.visitTest.results_entered_at
                                  ? formatDateTime(testResultData.visitTest.results_entered_at)
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col justify-between">
                            <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm h-full">
                              <p className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wider">Authorized Signature</p>
                              <div className="flex-grow flex items-end">
                                <div className="w-full">
                                  {testResultData.settings?.signature_image ? (
                                    <div className="mb-2">
                                      <img
                                        src={testResultData.settings.signature_image}
                                        alt="Authorized Signature"
                                        className="max-h-16 max-w-full object-contain mx-auto"
                                      />
                                    </div>
                                  ) : (
                                    <div className="border-b-2 border-gray-900 w-full mb-2 mt-12"></div>
                                  )}
                                  <p className="text-xs text-gray-700 text-center font-semibold">MEDICAL LAB SCIENTIST / LAB TECH</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 -mx-8 -mb-8 mt-8">
                      <div className="text-center space-y-2">
                        <p className="text-sm font-bold">
                          This is a computer-generated laboratory report.
                        </p>
                        <p className="text-xs text-blue-100">
                          Results are valid only with authorized signature and official stamp.
                        </p>
                        <p className="text-xs text-blue-100">
                          For any queries or clarifications, please contact the laboratory.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-600">
                  Test results not found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateAge(dob: string): { value: number; unit: string; display: string } {
  const birthDate = new Date(dob);
  const today = new Date();

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years === 0 && months === 0) {
    return {
      value: days,
      unit: 'days',
      display: `${days} ${days === 1 ? 'day' : 'days'}`
    };
  }

  if (years === 0) {
    return {
      value: months,
      unit: 'months',
      display: `${months} ${months === 1 ? 'month' : 'months'}`
    };
  }

  if (months === 0) {
    return {
      value: years,
      unit: 'years',
      display: `${years} ${years === 1 ? 'year' : 'years'}`
    };
  }

  return {
    value: years,
    unit: 'years',
    display: `${years} ${years === 1 ? 'year' : 'years'} ${months} ${months === 1 ? 'month' : 'months'}`
  };
}
