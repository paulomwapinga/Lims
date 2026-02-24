import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { formatDate, formatTime } from '../lib/dateFormat';
import { Printer } from 'lucide-react';

interface ReceiptProps {
  visitId: string;
  onClose?: () => void;
}

interface VisitData {
  id: string;
  created_at: string;
  notes: string;
  diagnosis: string;
  subtotal: number;
  total: number;
  paid: number;
  balance: number;
  payment_status: string;
  patient: {
    name: string;
    phone: string;
    age: number | null;
    age_unit: string | null;
  };
  doctor: {
    name: string;
  };
  tests: Array<{
    test_name: string;
    price: number;
    qty: number;
    result: string;
  }>;
  medicines: Array<{
    item_name: string;
    unit: string;
    price: number;
    qty: number;
    instructions: string;
  }>;
}

interface ClinicSettings {
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
  clinic_logo_url: string;
  clinic_website: string;
  signature_image: string | null;
}

export default function Receipt({ visitId, onClose }: ReceiptProps) {
  const [visit, setVisit] = useState<VisitData | null>(null);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const loadedVisitIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleClose = () => {
    if (!isPrinting && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (visitId && loadedVisitIdRef.current !== visitId) {
      loadedVisitIdRef.current = visitId;
      retryCountRef.current = 0;
      setLoading(true);
      setError(null);
      loadAllData();
    }
  }, [visitId]);

  useEffect(() => {
    const beforePrint = () => {
      setIsPrinting(true);
    };

    const afterPrint = () => {
      setTimeout(() => {
        setIsPrinting(false);
      }, 1000);
    };

    const preventClick = (e: MouseEvent) => {
      if (isPrinting) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    document.addEventListener('click', preventClick, true);

    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
      document.removeEventListener('click', preventClick, true);
    };
  }, [isPrinting]);

  async function loadAllData() {
    try {
      setError(null);

      if (!visitId) {
        throw new Error('No visit ID provided');
      }

      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select('*')
        .eq('id', visitId)
        .maybeSingle();

      if (visitError) {
        throw new Error(`Failed to load visit: ${visitError.message}`);
      }

      if (!visitData) {
        throw new Error('Visit not found');
      }

      const [
        { data: patientData },
        { data: doctorData },
        { data: visitTests },
        { data: visitMedicines },
        keyValueData,
        signatureData
      ] = await Promise.all([
        supabase
          .from('patients')
          .select('name, phone, age, age_unit')
          .eq('id', visitData.patient_id)
          .maybeSingle(),
        supabase
          .from('users')
          .select('name')
          .eq('id', visitData.doctor_id)
          .maybeSingle(),
        supabase
          .from('visit_tests')
          .select('test_id, price, qty, result')
          .eq('visit_id', visitId),
        supabase
          .from('visit_medicines')
          .select('item_id, price, qty, unit, instructions')
          .eq('visit_id', visitId),
        supabase.from('settings').select('key, value'),
        supabase.from('settings').select('signature_image').limit(1).maybeSingle()
      ]);

      const testIds = visitTests?.map((t: any) => t.test_id) || [];
      const medicineIds = visitMedicines?.map((m: any) => m.item_id) || [];

      const lookupPromises = [];
      if (testIds.length > 0) {
        lookupPromises.push(
          supabase.from('tests').select('id, name').in('id', testIds)
        );
      } else {
        lookupPromises.push(Promise.resolve({ data: [] }));
      }

      if (medicineIds.length > 0) {
        lookupPromises.push(
          supabase.from('inventory_items').select('id, name').in('id', medicineIds)
        );
      } else {
        lookupPromises.push(Promise.resolve({ data: [] }));
      }

      const [{ data: testsData }, { data: medicinesData }] = await Promise.all(lookupPromises);

      const testNames = (testsData || []).reduce((acc: any, t: any) => {
        acc[t.id] = t.name;
        return acc;
      }, {});

      const medicineNames = (medicinesData || []).reduce((acc: any, m: any) => {
        acc[m.id] = m.name;
        return acc;
      }, {});

      const settingsMap: any = {};
      if (keyValueData.data) {
        keyValueData.data.forEach((item: any) => {
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
        signature_image: signatureData.data?.signature_image || null,
      });

      setVisit({
        id: visitData.id,
        created_at: visitData.created_at,
        notes: visitData.notes,
        diagnosis: visitData.diagnosis,
        subtotal: visitData.subtotal,
        total: visitData.total,
        paid: visitData.paid,
        balance: visitData.balance,
        payment_status: visitData.payment_status,
        patient: {
          name: patientData?.name || 'Unknown',
          phone: patientData?.phone || '',
          age: patientData?.age || null,
          age_unit: patientData?.age_unit || null,
        },
        doctor: {
          name: doctorData?.name || 'Unknown',
        },
        tests: visitTests?.map((t: any) => ({
          test_name: testNames[t.test_id] || 'Unknown Test',
          price: t.price,
          qty: t.qty,
          result: t.result || '',
        })) || [],
        medicines: visitMedicines?.map((m: any) => ({
          item_name: medicineNames[m.item_id] || 'Unknown Item',
          unit: m.unit,
          price: m.price,
          qty: m.qty,
          instructions: m.instructions,
        })) || [],
      });
      retryCountRef.current = 0;
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading receipt:', error);

      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        console.log(`Retrying... attempt ${retryCountRef.current}/3`);
        setTimeout(() => {
          loadAllData();
        }, 1500);
      } else {
        setError(error.message || 'Failed to load receipt. Please refresh the page.');
        setLoading(false);
      }
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700 font-medium">Loading receipt...</p>
          {retryCountRef.current > 0 && (
            <p className="text-sm text-gray-500 mt-2">Retrying... ({retryCountRef.current}/3)</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !visit || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-semibold mb-2">Failed to load receipt</p>
            <p className="text-red-600 text-sm mb-4">{error || 'Please try again'}</p>
            <button
              onClick={() => {
                retryCountRef.current = 0;
                setLoading(true);
                setError(null);
                loadAllData();
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {isPrinting && (
        <div className="no-print fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <p className="text-lg font-semibold">Print dialog is open...</p>
            <p className="text-sm text-gray-600 mt-2">Choose your printer or select "Save as PDF"</p>
          </div>
        </div>
      )}
      <div className="no-print mb-4">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold">Receipt</h1>
          <div className="flex space-x-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isPrinting}
            >
              <Printer className="w-5 h-5" />
              <span>{isPrinting ? 'Printing...' : 'Print / Save as PDF'}</span>
            </button>
            {onClose && (
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isPrinting}
              >
                Close
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Click "Print / Save as PDF", then choose "Save as PDF" from the destination dropdown in the print dialog.
        </p>
      </div>

      <div className="bg-white p-8 max-w-4xl mx-auto" id="print-root">
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-6">
          {settings.clinic_logo_url && (
            <div className="flex justify-center mb-4">
              <img
                src={settings.clinic_logo_url}
                alt={settings.clinic_name}
                className="h-24 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{settings.clinic_name}</h1>
          {settings.clinic_address && <p className="text-gray-600 mt-1">{settings.clinic_address}</p>}
          <div className="flex justify-center items-center gap-4 text-sm text-gray-600 mt-2">
            {settings.clinic_phone && <p>Tel: {settings.clinic_phone}</p>}
            {settings.clinic_email && <p>Email: {settings.clinic_email}</p>}
          </div>
          {settings.clinic_website && <p className="text-sm text-gray-600 mt-1">{settings.clinic_website}</p>}
          <div className="mt-3">
            <h2 className="text-xl font-semibold text-gray-800">PAYMENT RECEIPT</h2>
          </div>
        </div>

        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200 no-break">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Patient Name</p>
              <p className="font-semibold text-lg text-gray-900 mt-1">{visit.patient.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Visit Date & Time</p>
              <p className="font-medium text-gray-900 mt-1">
                {formatDate(visit.created_at)}
              </p>
              <p className="text-sm text-gray-600">
                {formatTime(visit.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Phone</p>
              <p className="font-medium text-gray-900 mt-1">{visit.patient.phone}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Attending Doctor</p>
              <p className="font-medium text-gray-900 mt-1">{visit.doctor.name}</p>
            </div>
            {visit.patient.age && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Age</p>
                <p className="font-medium text-gray-900 mt-1">{visit.patient.age} {visit.patient.age_unit || 'years'}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Receipt No.</p>
              <p className="font-bold text-gray-900 mt-1 font-mono">{visit.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {visit.diagnosis && (
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-2">Diagnosis</p>
            <p className="font-medium text-gray-900">{visit.diagnosis}</p>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Items & Services</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="text-left py-3 px-4 font-semibold">Item</th>
                <th className="text-center py-3 px-4 font-semibold">Qty</th>
                <th className="text-right py-3 px-4 font-semibold">Price</th>
                <th className="text-right py-3 px-4 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visit.tests.map((test, index) => (
                <tr key={`test-${index}`} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{test.test_name}</div>
                    <div className="text-xs text-gray-500">Laboratory Test</div>
                    {test.result && (
                      <span className="block text-sm text-blue-600 mt-1">
                        Result: <span className="font-medium">{test.result}</span>
                      </span>
                    )}
                  </td>
                  <td className="text-center py-3 px-4">{test.qty}</td>
                  <td className="text-right py-3 px-4">{formatCurrency(test.price)}</td>
                  <td className="text-right py-3 px-4 font-semibold">
                    {formatCurrency(Number(test.price) * test.qty)}
                  </td>
                </tr>
              ))}
              {visit.medicines.map((medicine, index) => (
                <tr key={`medicine-${index}`} className={`border-b border-gray-200 ${(visit.tests.length + index) % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{medicine.item_name}</div>
                    <div className="text-xs text-gray-500">Medicine</div>
                    {medicine.instructions && (
                      <span className="block text-sm text-gray-600 italic mt-1">
                        {medicine.instructions}
                      </span>
                    )}
                  </td>
                  <td className="text-center py-3 px-4">
                    {medicine.qty} {medicine.unit}
                  </td>
                  <td className="text-right py-3 px-4">{formatCurrency(medicine.price)}</td>
                  <td className="text-right py-3 px-4 font-semibold">
                    {formatCurrency(Number(medicine.price) * Number(medicine.qty))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t-2 border-gray-800 pt-4 no-break">
          <div className="flex justify-end mb-2">
            <div className="w-80 space-y-3">
              <div className="flex justify-between text-xl font-bold bg-gray-800 text-white py-3 px-4 rounded-lg">
                <span>Total Amount:</span>
                <span>{formatCurrency(visit.total)}</span>
              </div>
              <div className="flex justify-between bg-green-50 py-2 px-4 rounded">
                <span className="text-gray-700 font-medium">Amount Paid:</span>
                <span className="font-semibold text-green-700">{formatCurrency(visit.paid)}</span>
              </div>
              {Number(visit.balance) > 0 && (
                <div className="flex justify-between bg-red-50 py-2 px-4 rounded">
                  <span className="text-gray-700 font-medium">Balance Due:</span>
                  <span className="font-bold text-red-600">{formatCurrency(visit.balance)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-gray-700 font-medium">Payment Status:</span>
                <span
                  className={`px-4 py-2 rounded-lg text-sm font-bold ${
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
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t-2 border-gray-300">
          <div className="flex justify-between items-end mb-6">
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-700 mb-1">Received By:</p>
              <div className="mt-8 border-b-2 border-gray-900 w-48"></div>
              <p className="text-xs text-gray-600 mt-1">Patient/Guardian Signature</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700 mb-1">Authorized By:</p>
              {settings.signature_image ? (
                <div className="mb-2">
                  <img
                    src={settings.signature_image}
                    alt="Authorized Signature"
                    className="max-h-16 max-w-full object-contain ml-auto"
                  />
                </div>
              ) : (
                <div className="border-b-2 border-gray-900 w-48 mt-8"></div>
              )}
              <p className="text-xs text-gray-600 mt-1">Admin/Doctor Signature</p>
            </div>
          </div>
          <div className="text-center text-gray-600">
            <p className="text-lg font-semibold mb-2">Thank you for choosing {settings.clinic_name}</p>
            <p className="text-sm text-gray-500 mt-4">
              This is a computer-generated receipt and is valid without signature.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
