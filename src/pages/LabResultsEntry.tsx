import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateTime } from '../lib/dateFormat';
import { getCurrentDateTime } from '../lib/timezone';
import { detectAbnormality, detectAbnormalityWithRules } from '../lib/abnormalityDetection';
import { ArrowLeft, Save, CheckCircle, Send, TrendingDown, TrendingUp } from 'lucide-react';

interface TestParameter {
  id: string;
  parameter_name: string;
  unit: string | null;
  ref_range_from: string | null;
  ref_range_to: string | null;
  parameter_type: string;
  allowed_values: string[] | null;
  applicable_to_male: boolean;
  applicable_to_female: boolean;
  applicable_to_child: boolean;
}

interface ExistingResult {
  id: string;
  test_parameter_id: string;
  value: string;
  is_abnormal: boolean;
  abnormality_type: 'L' | 'H' | null;
  notes: string | null;
}

interface VisitTestInfo {
  id: string;
  visit: {
    id: string;
    created_at: string;
    patient: {
      id: string;
      name: string;
      phone: string | null;
      age: number;
      age_unit: string;
      gender: string;
    };
    doctor: {
      id: string;
      name: string;
    };
  };
  test: {
    id: string;
    name: string;
  };
  results_status: string;
  technician_notes: string | null;
  sent_to_doctor_at: string | null;
}

interface ResultEntry {
  parameter_id: string;
  value: string;
  is_abnormal: boolean;
  abnormality_type: 'L' | 'H' | null;
  notes: string;
}

interface LabResultsEntryProps {
  visitTestId: string;
  onBack: () => void;
  onSaved?: () => void;
}

export default function LabResultsEntry({ visitTestId, onBack, onSaved }: LabResultsEntryProps) {
  const { user } = useAuth();
  const [visitTest, setVisitTest] = useState<VisitTestInfo | null>(null);
  const [parameters, setParameters] = useState<TestParameter[]>([]);
  const [results, setResults] = useState<Map<string, ResultEntry>>(new Map());
  const [existingResults, setExistingResults] = useState<ExistingResult[]>([]);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, [visitTestId]);

  const loadData = async () => {
    try {
      const { data: visitTestData, error: visitTestError } = await supabase
        .from('visit_tests')
        .select(`
          id,
          results_status,
          technician_notes,
          sent_to_doctor_at,
          visit_id,
          test_id
        `)
        .eq('id', visitTestId)
        .maybeSingle();

      if (visitTestError) {
        console.error('Error loading visit test:', visitTestError);
        throw visitTestError;
      }

      if (!visitTestData) {
        console.error('Visit test not found:', visitTestId);
        throw new Error('Visit test not found');
      }

      const [visitData, testData, existingResultsData] = await Promise.all([
        supabase
          .from('visits')
          .select(`
            id,
            created_at,
            patient_id,
            doctor_id,
            patients(id, name, phone, age, age_unit, gender),
            users!visits_doctor_id_fkey(id, name)
          `)
          .eq('id', visitTestData.visit_id)
          .maybeSingle(),
        supabase
          .from('tests')
          .select('id, name')
          .eq('id', visitTestData.test_id)
          .maybeSingle(),
        supabase
          .from('visit_test_results')
          .select('*')
          .eq('visit_test_id', visitTestId)
      ]);

      if (visitData.error) throw visitData.error;
      if (testData.error) throw testData.error;

      const combinedVisitTest: VisitTestInfo = {
        id: visitTestData.id,
        results_status: visitTestData.results_status,
        technician_notes: visitTestData.technician_notes,
        sent_to_doctor_at: visitTestData.sent_to_doctor_at,
        visit: {
          id: visitData.data?.id || '',
          created_at: visitData.data?.created_at || '',
          patient: {
            id: (visitData.data?.patients as any)?.id || '',
            name: (visitData.data?.patients as any)?.name || 'Unknown',
            phone: (visitData.data?.patients as any)?.phone || null,
            age: (visitData.data?.patients as any)?.age || 0,
            age_unit: (visitData.data?.patients as any)?.age_unit || 'years',
            gender: (visitData.data?.patients as any)?.gender || 'Unknown'
          },
          doctor: {
            id: (visitData.data?.users as any)?.id || '',
            name: (visitData.data?.users as any)?.name || 'Unknown'
          }
        },
        test: {
          id: testData.data?.id || '',
          name: testData.data?.name || 'Unknown'
        }
      };

      setVisitTest(combinedVisitTest);
      setTechnicianNotes(visitTestData.technician_notes || '');

      if (existingResultsData.data) {
        setExistingResults(existingResultsData.data);
        const resultsMap = new Map<string, ResultEntry>();
        existingResultsData.data.forEach((result: ExistingResult) => {
          resultsMap.set(result.test_parameter_id, {
            parameter_id: result.test_parameter_id,
            value: result.value,
            is_abnormal: result.is_abnormal,
            abnormality_type: result.abnormality_type || null,
            notes: result.notes || ''
          });
        });
        setResults(resultsMap);
      }

      const { data: parametersData, error: paramsError } = await supabase
        .from('test_parameters')
        .select('*')
        .eq('test_id', testData.data?.id)
        .order('sort_order', { ascending: true });

      if (paramsError) throw paramsError;
      setParameters(parametersData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Failed to load test information: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = async (parameterId: string, value: string) => {
    const newResults = new Map(results);
    const existing = newResults.get(parameterId) || {
      parameter_id: parameterId,
      value: '',
      is_abnormal: false,
      abnormality_type: null,
      notes: ''
    };

    const parameter = parameters.find(p => p.id === parameterId);

    const refFrom = parameter?.ref_range_from ? parseFloat(parameter.ref_range_from) : null;
    const refTo = parameter?.ref_range_to ? parseFloat(parameter.ref_range_to) : null;

    const detection = await detectAbnormalityWithRules(value, parameterId, refFrom, refTo);

    newResults.set(parameterId, {
      ...existing,
      value,
      is_abnormal: detection.isAbnormal,
      abnormality_type: detection.abnormalityType
    });

    setResults(newResults);
  };

  const handleAbnormalChange = (parameterId: string, isAbnormal: boolean) => {
    const newResults = new Map(results);
    const existing = newResults.get(parameterId) || {
      parameter_id: parameterId,
      value: '',
      is_abnormal: false,
      abnormality_type: null,
      notes: ''
    };
    newResults.set(parameterId, { ...existing, is_abnormal: isAbnormal });
    setResults(newResults);
  };

  const handleNotesChange = (parameterId: string, notes: string) => {
    const newResults = new Map(results);
    const existing = newResults.get(parameterId) || {
      parameter_id: parameterId,
      value: '',
      is_abnormal: false,
      abnormality_type: null,
      notes: ''
    };
    newResults.set(parameterId, { ...existing, notes });
    setResults(newResults);
  };

  const handleSave = async (markComplete: boolean = false) => {
    if (!user) return;

    setSaving(true);
    try {
      const resultsToSave = Array.from(results.values()).filter(r => r.value.trim() !== '');

      if (resultsToSave.length === 0) {
        alert('Please enter at least one result');
        setSaving(false);
        return;
      }

      const upsertPromises = resultsToSave.map(result => {
        const existing = existingResults.find(er => er.test_parameter_id === result.parameter_id);

        if (existing) {
          return supabase
            .from('visit_test_results')
            .update({
              value: result.value,
              is_abnormal: result.is_abnormal,
              abnormality_type: result.abnormality_type,
              notes: result.notes || null,
              updated_by: user.id,
              updated_at: getCurrentDateTime()
            })
            .eq('id', existing.id);
        } else {
          return supabase
            .from('visit_test_results')
            .insert({
              visit_test_id: visitTestId,
              test_parameter_id: result.parameter_id,
              value: result.value,
              is_abnormal: result.is_abnormal,
              abnormality_type: result.abnormality_type,
              notes: result.notes || null,
              created_by: user.id,
              updated_by: user.id
            });
        }
      });

      const resultsResponse = await Promise.all(upsertPromises);

      const errors = resultsResponse.filter(r => r.error);
      if (errors.length > 0) {
        console.error('Errors saving results:', errors);
        const errorMessages = errors.map(e => e.error?.message || 'Unknown error').join(', ');
        throw new Error(`Failed to save results: ${errorMessages}`);
      }

      const newStatus = markComplete ? 'completed' : 'in_progress';
      const updateData: any = {
        results_status: newStatus,
        technician_notes: technicianNotes || null
      };

      if (markComplete) {
        updateData.results_entered_at = getCurrentDateTime();
        updateData.results_entered_by = user.id;
      }

      const { error: statusError } = await supabase
        .from('visit_tests')
        .update(updateData)
        .eq('id', visitTestId);

      if (statusError) {
        console.error('Error updating visit_tests status:', statusError);
        throw statusError;
      }

      alert(markComplete ? 'Results saved and marked as complete!' : 'Results saved as draft!');

      if (onSaved) {
        onSaved();
      }

      if (markComplete) {
        onBack();
      } else {
        await loadData();
      }
    } catch (error) {
      console.error('Error saving results:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save results: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendToDoctor = async () => {
    if (!user || !visitTest) return;

    if (visitTest.results_status !== 'completed') {
      alert('Please complete and save the results before sending to doctor');
      return;
    }

    if (confirm(`Send test results to Dr. ${visitTest.visit.doctor.name}?`)) {
      setSending(true);
      try {
        const now = getCurrentDateTime();

        const { error: updateError } = await supabase
          .from('visit_tests')
          .update({
            sent_to_doctor_at: now,
            sent_to_doctor_by: user.id
          })
          .eq('id', visitTestId);

        if (updateError) throw updateError;

        const { data: adminUsers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin');

        const notificationsToInsert = [
          {
            user_id: visitTest.visit.doctor.id,
            type: 'lab_result_ready',
            title: 'Lab Results Ready',
            message: `Lab results for ${visitTest.test.name} are ready for patient ${visitTest.visit.patient.name}`,
            related_visit_test_id: visitTestId
          }
        ];

        if (adminUsers && adminUsers.length > 0) {
          adminUsers.forEach(admin => {
            notificationsToInsert.push({
              user_id: admin.id,
              type: 'lab_result_ready',
              title: 'Lab Results Ready',
              message: `Lab results for ${visitTest.test.name} are ready for patient ${visitTest.visit.patient.name}`,
              related_visit_test_id: visitTestId
            });
          });
        }

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationsToInsert);

        if (notifError) throw notifError;

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-lab-result-sms`;
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                visit_test_id: visitTestId,
                recipient_type: 'doctor',
              }),
            });

            const result = await response.json();
            if (response.ok && result.success) {
              console.log('SMS sent to doctor');
            } else {
              console.warn('Failed to send SMS to doctor:', result.error);
            }
          }
        } catch (smsError) {
          console.warn('SMS notification failed (non-critical):', smsError);
        }

        alert('Results successfully sent to doctor and admin!');

        if (onSaved) {
          onSaved();
        }

        onBack();
      } catch (error) {
        console.error('Error sending to doctor:', error);
        alert('Failed to send results. Please try again.');
      } finally {
        setSending(false);
      }
    }
  };

  const renderParameterInput = (parameter: TestParameter) => {
    const result = results.get(parameter.id);
    const value = result?.value || '';
    const isAbnormal = result?.is_abnormal || false;
    const abnormalityType = result?.abnormality_type || null;
    const notes = result?.notes || '';

    return (
      <div
        key={parameter.id}
        className={`bg-white border-2 rounded-lg p-5 transition-all ${
          isAbnormal ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-blue-300'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <label className="block text-base font-semibold text-gray-900 mb-1">
              {parameter.parameter_name}
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              {parameter.unit && (
                <span className="inline-flex items-center">
                  <span className="font-medium">Unit:</span>
                  <span className="ml-1">{parameter.unit}</span>
                </span>
              )}
              {(parameter.ref_range_from !== null || parameter.ref_range_to !== null) && (
                <span className="inline-flex items-center">
                  <span className="font-medium">Reference:</span>
                  <span className="ml-1">
                    {parameter.ref_range_from !== null && parameter.ref_range_to !== null
                      ? `${parameter.ref_range_from} - ${parameter.ref_range_to}`
                      : parameter.ref_range_from !== null
                        ? `${parameter.ref_range_from}+`
                        : `< ${parameter.ref_range_to}`}
                  </span>
                </span>
              )}
              {(parameter.applicable_to_male || parameter.applicable_to_female || parameter.applicable_to_child) && (
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium">Applicable to:</span>
                  {parameter.applicable_to_male && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                      Male
                    </span>
                  )}
                  {parameter.applicable_to_female && (
                    <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-semibold">
                      Female
                    </span>
                  )}
                  {parameter.applicable_to_child && (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                      Child
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {abnormalityType && (
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                abnormalityType === 'L'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
              }`}>
                {abnormalityType === 'L' ? (
                  <>
                    <TrendingDown className="w-3 h-3 mr-1" />
                    LOW
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3 h-3 mr-1" />
                    HIGH
                  </>
                )}
              </span>
            )}
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAbnormal}
                onChange={(e) => handleAbnormalChange(parameter.id, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className={`ml-2 text-sm font-medium ${isAbnormal ? 'text-red-700' : 'text-gray-700'}`}>
                Abnormal
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            {parameter.allowed_values && parameter.allowed_values.length > 0 ? (
              <select
                value={value}
                onChange={(e) => handleValueChange(parameter.id, e.target.value)}
                className={`block w-full rounded-lg border-2 shadow-sm focus:ring-2 focus:ring-blue-500 sm:text-sm py-2.5 px-3 ${
                  isAbnormal
                    ? 'border-red-300 bg-white'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
              >
                <option value="">Select a value...</option>
                {parameter.allowed_values.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            ) : parameter.parameter_type === 'text' ? (
              <textarea
                value={value}
                onChange={(e) => handleValueChange(parameter.id, e.target.value)}
                rows={2}
                className={`block w-full rounded-lg border-2 shadow-sm focus:ring-2 focus:ring-blue-500 sm:text-sm py-2.5 px-3 ${
                  isAbnormal
                    ? 'border-red-300 bg-white'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="Enter result..."
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => handleValueChange(parameter.id, e.target.value)}
                className={`block w-full rounded-lg border-2 shadow-sm focus:ring-2 focus:ring-blue-500 sm:text-sm py-2.5 px-3 ${
                  isAbnormal
                    ? 'border-red-300 bg-white'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
                placeholder="Enter value..."
              />
            )}
          </div>

          {(notes || value) && (
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => handleNotesChange(parameter.id, e.target.value)}
                placeholder="Additional notes (optional)..."
                className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-sm py-2 px-3"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!visitTest) {
    return (
      <div className="text-center text-red-600">
        Test information not found
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to List
        </button>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Enter Test Results</h2>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-white">
            {visitTest.test.name}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <span className="text-gray-500 font-medium min-w-[100px]">Patient:</span>
            <span className="font-semibold text-gray-900">{visitTest.visit.patient.name}</span>
            <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              ID: {visitTest.visit.patient.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 font-medium min-w-[100px]">Age/Gender:</span>
            <span className="font-semibold text-gray-900">
              {visitTest.visit.patient.age} {visitTest.visit.patient.age_unit}
            </span>
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded bg-gray-100">
              {visitTest.visit.patient.gender}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 font-medium min-w-[100px]">Doctor:</span>
            <span className="font-semibold text-gray-900">Dr. {visitTest.visit.doctor.name}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 font-medium min-w-[100px]">Visit Date:</span>
            <span className="font-semibold text-gray-900">
              {formatDate(visitTest.visit.created_at)}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 font-medium min-w-[100px]">Status:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              visitTest.results_status === 'completed'
                ? 'bg-green-100 text-green-800'
                : visitTest.results_status === 'in_progress'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {visitTest.results_status === 'completed' ? 'Completed' :
               visitTest.results_status === 'in_progress' ? 'In Progress' : 'Pending'}
            </span>
          </div>
          {visitTest.sent_to_doctor_at && (
            <div className="flex items-center md:col-span-2">
              <span className="text-gray-500 font-medium min-w-[100px]">Sent to Doctor:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {formatDateTime(visitTest.sent_to_doctor_at)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Technician Notes
          </label>
          <textarea
            value={technicianNotes}
            onChange={(e) => setTechnicianNotes(e.target.value)}
            rows={2}
            className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-sm py-2.5 px-3"
            placeholder="Add general notes about this test..."
          />
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Test Parameters</h3>
          <span className="text-sm text-gray-500">
            {parameters.length} parameter{parameters.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {parameters.map(renderParameterInput)}
        </div>
      </div>

      <div className="sticky bottom-0 bg-white shadow-lg rounded-xl p-4 border-2 border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Progress:</span>
            <span className="ml-2">
              {Array.from(results.values()).filter(r => r.value.trim() !== '').length} of {parameters.length} entered
            </span>
          </div>
          {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.is_abnormal).length > 0 && (
            <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
              <span className="font-medium">Abnormal:</span>
              {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.abnormality_type === 'L').length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-300">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.abnormality_type === 'L').length} Low
                </span>
              )}
              {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.abnormality_type === 'H').length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-700 border border-red-300">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.abnormality_type === 'H').length} High
                </span>
              )}
              {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.is_abnormal && !r.abnormality_type).length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
                  {Array.from(results.values()).filter(r => r.value.trim() !== '' && r.is_abnormal && !r.abnormality_type).length} Other
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 border-2 border-gray-300 shadow-sm text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 border-2 border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save & Complete'}
          </button>
          {visitTest?.results_status === 'completed' && !visitTest?.sent_to_doctor_at && (
            <button
              onClick={handleSendToDoctor}
              disabled={sending}
              className="inline-flex items-center px-5 py-2.5 border-2 border-transparent shadow-md text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-all"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Sending...' : 'Send to Doctor'}
            </button>
          )}
          {visitTest?.sent_to_doctor_at && (
            <div className="inline-flex items-center px-5 py-2.5 border-2 border-green-300 shadow-sm text-sm font-semibold rounded-lg text-green-700 bg-green-50">
              <CheckCircle className="w-4 h-4 mr-2" />
              Sent to Doctor
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
