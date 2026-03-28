import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDate, formatDateTime } from '../lib/dateFormat';
import { ArrowLeft, Printer, CreditCard as Edit, Trash2, Download, TrendingDown, TrendingUp } from 'lucide-react';

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
      gender: string;
      age: number;
      age_unit: string;
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

interface LabResultsViewProps {
  visitTestId: string;
  onBack: () => void;
  onEdit?: () => void;
}

const calculateAge = (dob: string): { value: number; unit: string; display: string } => {
  if (!dob) {
    return { value: 0, unit: 'years', display: 'Unknown' };
  }

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

  // For very young patients (less than 1 year)
  if (years === 0 && months === 0) {
    return {
      value: days,
      unit: 'days',
      display: `${days} ${days === 1 ? 'day' : 'days'}`
    };
  }

  // For infants (less than 1 year old)
  if (years === 0) {
    return {
      value: months,
      unit: 'months',
      display: `${months} ${months === 1 ? 'month' : 'months'}`
    };
  }

  // For everyone else, show years and optionally months
  const yearText = `${years} ${years === 1 ? 'year' : 'years'}`;
  const monthText = months > 0 ? ` ${months} ${months === 1 ? 'month' : 'months'}` : '';

  return {
    value: years,
    unit: 'years',
    display: `${yearText}${monthText}`
  };
};

export default function LabResultsView({ visitTestId, onBack, onEdit }: LabResultsViewProps) {
  const { profile } = useAuth();
  const [visitTest, setVisitTest] = useState<VisitTestInfo | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [enteredByName, setEnteredByName] = useState<string | null>(null);
  const [enteredByRole, setEnteredByRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handlePrint = () => {
    if (!visitTest) return;

    const patientName = visitTest.visit.patient.name.replace(/[^a-zA-Z0-9]/g, '_');
    const testName = visitTest.test.name.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date(visitTest.results_entered_at || visitTest.visit.created_at)
      .toISOString()
      .split('T')[0];
    const fileName = `LabResult_${patientName}_${testName}_${date}`;

    const originalTitle = document.title;
    document.title = fileName;

    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  useEffect(() => {
    loadData();
  }, [visitTestId]);

  useEffect(() => {
    const beforePrint = () => {
      document.body.style.overflow = 'visible';
    };

    const afterPrint = () => {
      document.body.style.overflow = '';
    };

    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);

    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  const loadData = async () => {
    try {
      const [visitTestData, resultsData, keyValueData, signatureData] = await Promise.all([
        supabase
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
                gender,
                age,
                age_unit
              )
            ),
            test:tests (
              name
            )
          `)
          .eq('id', visitTestId)
          .maybeSingle(),
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
      ]);

      if (visitTestData.error) {
        console.error('Visit test error:', visitTestData.error);
        throw visitTestData.error;
      }

      if (!visitTestData.data) {
        throw new Error('Test result not found');
      }

      setVisitTest(visitTestData.data as any);

      if (resultsData.error) {
        console.error('Results data error:', resultsData.error);
        throw resultsData.error;
      }

      if (resultsData.data) {
        const sortedResults = (resultsData.data as any).sort(
          (a: TestResult, b: TestResult) =>
            a.test_parameter.sort_order - b.test_parameter.sort_order
        );
        console.log('Test Results Data:', sortedResults);
        setResults(sortedResults);
      }

      if (keyValueData.error) {
        console.error('Settings error (non-fatal):', keyValueData.error);
      }

      const settingsMap: any = {};

      if (keyValueData.data) {
        keyValueData.data.forEach((item: any) => {
          settingsMap[item.key] = item.value;
        });
      }

      if (signatureData.error) {
        console.error('Signature error (non-fatal):', signatureData.error);
      }

      if (signatureData.data?.signature_image) {
        settingsMap.signature_image = signatureData.data.signature_image;
      }

      setSettings(settingsMap);

      if (visitTestData.data?.results_entered_by) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, role')
          .eq('id', visitTestData.data.results_entered_by)
          .maybeSingle();

        if (userData) {
          setEnteredByName(userData.name);
          setEnteredByRole(userData.role);
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Failed to load test results: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };


  const handleDownloadPDF = () => {
    if (!visitTest) return;

    const patientName = visitTest.visit.patient.name.replace(/[^a-zA-Z0-9]/g, '_');
    const testName = visitTest.test.name.replace(/[^a-zA-Z0-9]/g, '_');
    const date = new Date(visitTest.results_entered_at || visitTest.visit.created_at)
      .toISOString()
      .split('T')[0];
    const fileName = `LabResult_${patientName}_${testName}_${date}`;

    const originalTitle = document.title;
    document.title = fileName;

    const images = document.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        img.onload = () => resolve(null);
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 3000);
      });
    });

    Promise.all(imagePromises).then(() => {
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.title = originalTitle;
        }, 500);
      }, 100);
    });
  };

  const handleDelete = async () => {
    if (!profile || profile.role !== 'admin') {
      alert('Only administrators can delete lab results');
      return;
    }

    const confirmDelete = confirm(
      'Are you sure you want to delete these lab results? This action cannot be undone.'
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('visit_test_results')
        .delete()
        .eq('visit_test_id', visitTestId);

      if (error) throw error;

      await supabase
        .from('visit_tests')
        .update({
          results_status: 'pending',
          results_entered_at: null,
          results_entered_by: null,
          technician_notes: null,
        })
        .eq('id', visitTestId);

      alert('Lab results deleted successfully');
      onBack();
    } catch (error: any) {
      console.error('Error deleting results:', error);
      alert(`Failed to delete results: ${error.message || 'Unknown error'}`);
    }
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
        Test results not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to List
          </button>
          <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Results
            </button>
          )}
          {profile?.role === 'admin' && results.length > 0 && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Results
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </button>
        </div>
        </div>
      </div>

      <div id="print-root">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6">
            <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {settings?.clinic_logo_url && (
                <div className="bg-white rounded-lg p-2 shadow-md">
                  <img
                    src={settings.clinic_logo_url}
                    alt={settings?.clinic_name || 'Medical Laboratory'}
                    className="h-16 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="text-left">
                <h1 className="text-2xl font-bold tracking-tight">
                  {settings?.clinic_name || 'Remtullah Medical Laboratory'}
                </h1>
                {settings?.clinic_address && (
                  <p className="text-blue-100 text-sm mt-1">{settings.clinic_address}</p>
                )}
              </div>
            </div>
            <div className="text-right text-sm space-y-1">
              {settings?.clinic_phone && (
                <p className="text-blue-100">Tel: {settings.clinic_phone}</p>
              )}
              {settings?.clinic_email && (
                <p className="text-blue-100">Email: {settings.clinic_email}</p>
              )}
              {settings?.clinic_website && (
                <p className="text-blue-100">{settings.clinic_website}</p>
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

            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-100">
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
                      {visitTest.visit.patient.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Patient ID</span>
                    <span className="text-gray-900 font-mono font-semibold">{visitTest.visit.patient.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Date of Birth</span>
                    <span className="text-gray-900 font-semibold">
                      {visitTest.visit.patient.dob ? (
                        <>
                          {formatDate(visitTest.visit.patient.dob)} <span className="text-sm">({calculateAge(visitTest.visit.patient.dob).display})</span>
                        </>
                      ) : (
                        'N/A'
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Gender</span>
                    <span className="text-gray-900 font-semibold capitalize">{visitTest.visit.patient.gender}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Visit ID</span>
                    <span className="text-gray-900 font-mono font-semibold">#{visitTest.visit.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Visit Date</span>
                    <span className="text-gray-900 font-semibold">
                      {formatDate(visitTest.visit.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Test Name</span>
                    <span className="text-base font-bold text-gray-900">{visitTest.test.name}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">Report Date</span>
                    <span className="text-gray-900 font-semibold">
                      {visitTest.results_entered_at
                        ? formatDate(visitTest.results_entered_at)
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider">
                Test Results
              </div>
            </div>
            {results.length === 0 ? (
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
                    {results.map((result, index) => (
                      <tr
                        key={result.id}
                        className={`border-b border-gray-200 transition-colors ${
                          result.is_abnormal
                            ? result.abnormality_type === 'L'
                              ? 'bg-blue-50 hover:bg-blue-100'
                              : result.abnormality_type === 'H'
                              ? 'bg-red-50 hover:bg-red-100'
                              : 'bg-red-50 hover:bg-red-100'
                            : index % 2 === 0
                            ? 'bg-white hover:bg-gray-50'
                            : 'bg-gray-50 hover:bg-gray-100'
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
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-md">
                                  <TrendingDown className="w-3.5 h-3.5 mr-1" />
                                  LOW (L)
                                </span>
                              ) : result.abnormality_type === 'H' ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs shadow-md">
                                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                                  HIGH (H)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs shadow-md" title={`Type: ${result.abnormality_type}, IsAbnormal: ${result.is_abnormal}`}>
                                  ABNORMAL {result.abnormality_type ? `(${result.abnormality_type})` : ''}
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs shadow-md">
                                NORMAL
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {visitTest.technician_notes && (
            <div className="mb-6 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 shadow-sm">
              <div className="flex items-center mb-3">
                <div className="bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                  Technician Notes
                </div>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed font-medium">{visitTest.technician_notes}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t-2 border-blue-200 no-break">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <div className="p-5 rounded-xl border border-blue-200 shadow-sm" style={{ backgroundColor: '#e2eefe' }}>
                  <p className="text-xs uppercase tracking-wider text-blue-700 font-bold mb-2">
                    Results Entered By
                  </p>
                  <p className="font-bold text-gray-900 text-base">
                    {enteredByName || 'N/A'}
                  </p>
                  {enteredByRole && (
                    <p className="text-xs text-blue-600 mt-1 capitalize font-semibold">
                      {enteredByRole.replace('_', ' ')}
                    </p>
                  )}
                </div>
                <div className="p-5 rounded-xl border border-blue-200 shadow-sm" style={{ backgroundColor: '#e2eefe' }}>
                  <p className="text-xs uppercase tracking-wider text-blue-700 font-bold mb-2">
                    Report Date & Time
                  </p>
                  <p className="font-bold text-gray-900 text-base">
                    {visitTest.results_entered_at
                      ? formatDateTime(visitTest.results_entered_at)
                      : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm h-full">
                  <p className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wider">Authorized Signature</p>
                  <div className="flex-grow flex items-end">
                    <div className="w-full">
                      {settings?.signature_image ? (
                        <div className="mb-2">
                          <img
                            src={settings.signature_image}
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
    </div>
  );
}
