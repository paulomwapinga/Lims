import { useEffect, useState, FormEvent, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency } from '../lib/currency';
import { Search, Plus, Trash2, Save, Package, AlertTriangle, CheckCircle, Eye, X } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number | null;
  age_unit: string | null;
  dob: string | null;
}

function getPatientAge(patient: Patient): string {
  if (patient.dob) {
    const dob = new Date(patient.dob);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    if (years > 0 && months > 0) return `${years} years ${months} months`;
    if (years > 0) return `${years} years`;
    if (months > 0) return `${months} months`;
    const days = Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }
  if (patient.age) return `${patient.age} ${patient.age_unit || 'years'}`;
  return '';
}

interface Test {
  id: string;
  name: string;
  price: number;
}

interface Medicine {
  id: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  sell_price: number;
}

interface VisitTest {
  test_id: string;
  test_name: string;
  price: number;
  qty: number;
  result: string;
}

interface VisitMedicine {
  item_id: string;
  item_name: string;
  unit: string;
  price: number;
  qty: number;
  instructions: string;
}

interface TestConsumable {
  item_id: string;
  item_name: string;
  quantity_required: number;
  available_stock: number;
  unit: string;
}

interface TestStockInfo {
  test_id: string;
  consumables: TestConsumable[];
  can_perform: boolean;
  max_tests_possible: number;
}

interface Unit {
  id: string;
  name: string;
  description: string;
}

interface VisitsProps {
  initialPatientId?: string;
  onViewReceipt?: (visitId: string) => void;
}

export default function Visits({ initialPatientId, onViewReceipt }: VisitsProps) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [visitTests, setVisitTests] = useState<VisitTest[]>([]);
  const [visitMedicines, setVisitMedicines] = useState<VisitMedicine[]>([]);

  const [formData, setFormData] = useState({
    notes: '',
    diagnosis: '',
  });

  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showMedicineDialog, setShowMedicineDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [testForm, setTestForm] = useState({ test_id: '', qty: '1' });
  const [medicineForm, setMedicineForm] = useState({
    item_id: '',
    qty: '',
    unit: '',
    instructions: '',
  });

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [testSearchTerm, setTestSearchTerm] = useState('');
  const [testQuantities, setTestQuantities] = useState<Record<string, string>>({});
  const [testStockInfo, setTestStockInfo] = useState<Map<string, TestStockInfo>>(new Map());

  const patientSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPatients();
    loadTests();
    loadMedicines();
    loadUnits();

    if (initialPatientId) {
      loadPatient(initialPatientId);
    }
  }, [initialPatientId]);

  useEffect(() => {
    if (patientSearchDebounce.current) clearTimeout(patientSearchDebounce.current);
    patientSearchDebounce.current = setTimeout(() => {
      loadPatients(searchTerm);
    }, 250);
    return () => {
      if (patientSearchDebounce.current) clearTimeout(patientSearchDebounce.current);
    };
  }, [searchTerm]);

  async function loadPatients(search = '') {
    const query = supabase
      .from('patients')
      .select('id, name, phone, age, age_unit, dob')
      .order('name')
      .limit(100);

    if (search.trim()) {
      query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data } = await query;
    setPatients(data || []);
  }

  async function loadTests() {
    const { data } = await supabase.from('tests').select('*').order('name').limit(500);
    setTests(data || []);
  }

  async function loadMedicines() {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('type', 'medicine')
      .order('name')
      .limit(500);
    setMedicines(data || []);
  }

  async function loadUnits() {
    const { data } = await supabase
      .from('units')
      .select('*')
      .order('name')
      .limit(200);
    setUnits(data || []);
  }

  async function loadPatient(patientId: string) {
    const patient = patients.find((p) => p.id === patientId);
    if (patient) {
      setSelectedPatient(patient);
    } else {
      const { data } = await supabase
        .from('patients')
        .select('id, name, phone, age, age_unit, dob')
        .eq('id', patientId)
        .maybeSingle();
      if (data) setSelectedPatient(data);
    }
  }

  async function handleAddTest(e: FormEvent) {
    e.preventDefault();

    if (selectedTestIds.length === 0) {
      alert('Please select at least one test');
      return;
    }

    const testsToAdd: VisitTest[] = [];
    const selectedTests = tests.filter((t) => selectedTestIds.includes(t.id));

    for (const test of selectedTests) {
      const qty = parseInt(testQuantities[test.id] || '1');

      const { data: consumptions } = await supabase
        .from('test_consumables')
        .select(
          `
          quantity,
          inventory_items(id, name, qty_on_hand, unit)
        `
        )
        .eq('test_id', test.id);

      if (consumptions) {
        for (const c of consumptions) {
          const item = c.inventory_items as any;
          const required = c.quantity * qty;

          const alreadyUsedInCurrentVisit = visitTests
            .filter((vt) => vt.test_id === test.id)
            .reduce((sum, vt) => sum + (c.quantity * vt.qty), 0);

          const totalRequired = alreadyUsedInCurrentVisit + required;

          if (item.qty_on_hand < totalRequired) {
            alert(
              `Insufficient stock for ${test.name}: ${item.name}. Required: ${totalRequired} ${item.unit}, Available: ${item.qty_on_hand} ${item.unit}`
            );
            return;
          }
        }
      }

      testsToAdd.push({
        test_id: test.id,
        test_name: test.name,
        price: test.price,
        qty,
        result: '',
      });
    }

    setVisitTests([...visitTests, ...testsToAdd]);
    setSelectedTestIds([]);
    setTestQuantities({});
    setTestSearchTerm('');
    setTestStockInfo(new Map());
    setShowTestDialog(false);
  }

  async function loadTestStockInfo(testId: string) {
    try {
      const { data: consumptions, error } = await supabase
        .from('test_consumables')
        .select(`
          quantity,
          inventory_items (
            id,
            name,
            qty_on_hand,
            unit
          )
        `)
        .eq('test_id', testId);

      if (error) throw error;

      const consumables: TestConsumable[] = consumptions?.map((c: any) => ({
        item_id: c.inventory_items.id,
        item_name: c.inventory_items.name,
        quantity_required: c.quantity,
        available_stock: c.inventory_items.qty_on_hand,
        unit: c.inventory_items.unit,
      })) || [];

      let maxTestsPossible = Infinity;
      let canPerform = true;

      if (consumables.length > 0) {
        consumables.forEach((c) => {
          const possibleTests = Math.floor(c.available_stock / c.quantity_required);
          maxTestsPossible = Math.min(maxTestsPossible, possibleTests);
          if (possibleTests === 0) canPerform = false;
        });
      } else {
        maxTestsPossible = 999;
      }

      const stockInfo: TestStockInfo = {
        test_id: testId,
        consumables,
        can_perform: canPerform,
        max_tests_possible: maxTestsPossible === Infinity ? 999 : maxTestsPossible,
      };

      setTestStockInfo((prev) => new Map(prev).set(testId, stockInfo));
    } catch (error) {
      console.error('Error loading test stock info:', error);
    }
  }

  function toggleTestSelection(testId: string) {
    setSelectedTestIds((prev) => {
      if (prev.includes(testId)) {
        const newQuantities = { ...testQuantities };
        delete newQuantities[testId];
        setTestQuantities(newQuantities);

        const newStockInfo = new Map(testStockInfo);
        newStockInfo.delete(testId);
        setTestStockInfo(newStockInfo);

        return prev.filter((id) => id !== testId);
      } else {
        setTestQuantities({ ...testQuantities, [testId]: '1' });
        loadTestStockInfo(testId);
        return [...prev, testId];
      }
    });
  }

  function toggleSelectAllTests() {
    const filtered = getFilteredTests();
    if (selectedTestIds.length === filtered.length) {
      setSelectedTestIds([]);
      setTestQuantities({});
      setTestStockInfo(new Map());
    } else {
      setSelectedTestIds(filtered.map((t) => t.id));
      const newQuantities: Record<string, string> = {};
      filtered.forEach((t) => {
        newQuantities[t.id] = testQuantities[t.id] || '1';
        loadTestStockInfo(t.id);
      });
      setTestQuantities(newQuantities);
    }
  }

  function getFilteredTests() {
    return tests.filter((test) =>
      test.name.toLowerCase().includes(testSearchTerm.toLowerCase())
    );
  }

  async function handleAddMedicine(e: FormEvent) {
    e.preventDefault();

    const medicine = medicines.find((m) => m.id === medicineForm.item_id);
    if (!medicine) return;

    const qty = parseFloat(medicineForm.qty);

    const alreadyAdded = visitMedicines
      .filter((m) => m.item_id === medicine.id)
      .reduce((sum, m) => sum + m.qty, 0);

    const totalRequired = alreadyAdded + qty;

    if (medicine.qty_on_hand < totalRequired) {
      alert(
        `Insufficient stock for ${medicine.name}. Available: ${medicine.qty_on_hand} ${medicine.unit}, Already added: ${alreadyAdded} ${medicine.unit}, Requested: ${qty} ${medicine.unit}`
      );
      return;
    }

    setVisitMedicines([
      ...visitMedicines,
      {
        item_id: medicine.id,
        item_name: medicine.name,
        unit: medicineForm.unit,
        price: medicine.sell_price,
        qty,
        instructions: medicineForm.instructions,
      },
    ]);

    setMedicineForm({ item_id: '', qty: '', unit: '', instructions: '' });
    setShowMedicineDialog(false);
  }

  function removeTest(index: number) {
    setVisitTests(visitTests.filter((_, i) => i !== index));
  }

  function removeMedicine(index: number) {
    setVisitMedicines(visitMedicines.filter((_, i) => i !== index));
  }

  function calculateTotals() {
    const testsTotal = visitTests.reduce((sum, t) => sum + t.price * t.qty, 0);
    const medicinesTotal = visitMedicines.reduce((sum, m) => sum + m.price * m.qty, 0);
    const subtotal = testsTotal + medicinesTotal;
    const total = subtotal;
    const paid = total;
    const balance = 0;

    return { subtotal, total, paid, balance };
  }

  function handleSaveVisitClick() {
    if (!selectedPatient || !profile) {
      alert('Please select a patient');
      return;
    }

    if (visitTests.length === 0 && visitMedicines.length === 0) {
      alert('Please add at least one test or medicine');
      return;
    }

    setShowConfirmDialog(true);
  }

  async function handleSaveVisit() {
    setShowConfirmDialog(false);
    setIsSaving(true);

    try {
      const totals = calculateTotals();

      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          patient_id: selectedPatient.id,
          doctor_id: profile.id,
          notes: formData.notes,
          diagnosis: formData.diagnosis,
          subtotal: totals.subtotal,
          total: totals.total,
          paid: totals.paid,
          balance: totals.balance,
          payment_status: 'paid',
        })
        .select()
        .single();

      if (visitError) throw visitError;

      const insertPromises = [];

      if (visitTests.length > 0) {
        const testsToInsert = visitTests.map(test => ({
          visit_id: visit.id,
          test_id: test.test_id,
          price: test.price,
          qty: test.qty,
          result: test.result,
        }));
        insertPromises.push(supabase.from('visit_tests').insert(testsToInsert));
      }

      if (visitMedicines.length > 0) {
        const medicinesToInsert = visitMedicines.map(medicine => ({
          visit_id: visit.id,
          item_id: medicine.item_id,
          price: medicine.price,
          qty: medicine.qty,
          unit: medicine.unit,
          instructions: medicine.instructions,
        }));
        insertPromises.push(supabase.from('visit_medicines').insert(medicinesToInsert));
      }

      const results = await Promise.all(insertPromises);

      for (const result of results) {
        if (result.error) throw result.error;
      }

      setIsSaving(false);
      resetForm();

      if (onViewReceipt) {
        onViewReceipt(visit.id);
      }
    } catch (error: any) {
      console.error('Error saving visit:', error);
      setIsSaving(false);

      let errorMessage = 'Failed to save visit. Please try again.';

      if (error?.message) {
        if (error.message.includes('Insufficient inventory')) {
          errorMessage = 'Insufficient inventory: ' + error.message.split('Insufficient inventory')[1];
        } else {
          errorMessage = error.message;
        }
      }

      alert(errorMessage);
    }
  }

  function resetForm() {
    setSelectedPatient(null);
    setVisitTests([]);
    setVisitMedicines([]);
    setFormData({ notes: '', diagnosis: '' });
  }

  const totals = calculateTotals();
  const filteredPatients = patients;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">New Visit</h1>
        <p className="text-gray-600">All completed visits are saved to Visit History</p>
      </div>

      {!selectedPatient ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">Select Patient</h2>
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredPatients.map((patient, index) => (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 flex items-center space-x-3"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{patient.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {patient.phone}{getPatientAge(patient) ? ` • ${getPatientAge(patient)}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {filteredPatients.length === 0 && (
              <p className="text-gray-500 text-center py-12">No patients found</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedPatient.name}</h2>
                <p className="text-gray-600 mt-1">
                  {selectedPatient.phone}{getPatientAge(selectedPatient) ? ` • ${getPatientAge(selectedPatient)}` : ''}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Change Patient
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Complaints / Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Enter patient complaints and observations..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Diagnosis</label>
                  {formData.diagnosis && (
                    <button
                      type="button"
                      onClick={() => setShowDiagnosisModal(true)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      title="View full diagnosis"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  rows={4}
                  placeholder="Enter diagnosis..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Tests</h3>
              <button
                onClick={() => setShowTestDialog(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Add Test</span>
              </button>
            </div>

            {visitTests.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500">No tests added yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "Add Test" to begin</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visitTests.map((test, index) => (
                  <div key={index} className="bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-100 p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{test.test_name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Qty: {test.qty} × {formatCurrency(test.price)} = <span className="font-semibold text-blue-700">{formatCurrency(test.qty * test.price)}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => removeTest(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Result (Optional)
                      </label>
                      <input
                        type="text"
                        value={test.result}
                        onChange={(e) => {
                          const updated = [...visitTests];
                          updated[index].result = e.target.value;
                          setVisitTests(updated);
                        }}
                        placeholder="e.g., Positive, Negative, or numeric value"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Medicines</h3>
              <button
                onClick={() => setShowMedicineDialog(true)}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Dispense Medicine</span>
              </button>
            </div>

            {visitMedicines.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500">No medicines dispensed yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "Dispense Medicine" to begin</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visitMedicines.map((medicine, index) => (
                  <div key={index} className="flex justify-between items-center bg-gradient-to-r from-green-50 to-green-50/50 border border-green-100 p-4 rounded-xl">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{medicine.item_name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Qty: {medicine.qty} {medicine.unit} × {formatCurrency(medicine.price)} = <span className="font-semibold text-green-700">{formatCurrency(medicine.qty * medicine.price)}</span>
                      </p>
                      {medicine.instructions && (
                        <p className="text-sm text-gray-600 italic mt-2 bg-white/60 px-3 py-1.5 rounded-lg inline-block">
                          {medicine.instructions}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeMedicine(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors ml-4"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Payment Summary</h3>

            <div className="space-y-4 bg-gray-50 rounded-xl p-5">
              <div className="flex justify-between text-2xl font-bold text-gray-900">
                <span>Total Amount:</span>
                <span className="text-blue-700">{formatCurrency(totals.total)}</span>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mt-4">
                <p className="text-blue-800 text-sm font-medium">
                  Full payment of {formatCurrency(totals.total)} will be recorded when this visit is saved.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
              <button
                onClick={resetForm}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVisitClick}
                disabled={isSaving || totals.total === 0}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all ${
                  isSaving || totals.total === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Save Visit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTestDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Add Tests</h2>
            <form onSubmit={handleAddTest} className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={testSearchTerm}
                  onChange={(e) => setTestSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-between items-center py-3 border-b-2 border-gray-200">
                <button
                  type="button"
                  onClick={toggleSelectAllTests}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {selectedTestIds.length === getFilteredTests().length && getFilteredTests().length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
                <span className="text-sm text-gray-600 font-medium">
                  {selectedTestIds.length} test{selectedTestIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 bg-gray-50">
                {getFilteredTests().length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tests found</p>
                ) : (
                  getFilteredTests().map((test) => (
                    <label
                      key={test.id}
                      className={`flex items-center space-x-4 p-4 rounded-xl cursor-pointer transition-all ${
                        selectedTestIds.includes(test.id)
                          ? 'bg-blue-100 border-2 border-blue-400 shadow-sm'
                          : 'bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTestIds.includes(test.id)}
                        onChange={() => toggleTestSelection(test.id)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{test.name}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{formatCurrency(test.price)}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              {selectedTestIds.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-semibold text-gray-800">Selected Tests & Quantities</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTestIds([]);
                        setTestQuantities({});
                        setTestStockInfo(new Map());
                      }}
                      className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="space-y-3 mb-4">
                    {selectedTestIds.map((testId) => {
                      const test = tests.find((t) => t.id === testId);
                      if (!test) return null;
                      const qty = parseInt(testQuantities[testId] || '1');
                      const stockInfo = testStockInfo.get(testId);

                      return (
                        <div key={testId} className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{test.name}</p>
                              <p className="text-sm text-gray-600">{formatCurrency(test.price)} × {qty} = {formatCurrency(test.price * qty)}</p>
                            </div>
                            <div className="ml-4">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">Qty</label>
                              <input
                                type="number"
                                min="1"
                                required
                                value={testQuantities[testId] || '1'}
                                onChange={(e) => {
                                  setTestQuantities({
                                    ...testQuantities,
                                    [testId]: e.target.value,
                                  });
                                }}
                                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                              />
                            </div>
                          </div>

                          {stockInfo && stockInfo.consumables.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-gray-700">Recipe Stock Status:</p>
                                {stockInfo.can_perform && stockInfo.max_tests_possible >= qty ? (
                                  <span className="flex items-center text-xs font-semibold text-green-700">
                                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                    Stock Available
                                  </span>
                                ) : (
                                  <span className="flex items-center text-xs font-semibold text-red-700">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                    Insufficient Stock
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                {stockInfo.consumables.map((consumable) => {
                                  const requiredForQty = consumable.quantity_required * qty;
                                  const hasEnough = consumable.available_stock >= requiredForQty;
                                  const maxPossible = Math.floor(consumable.available_stock / consumable.quantity_required);

                                  return (
                                    <div
                                      key={consumable.item_id}
                                      className={`flex items-center justify-between text-xs p-2 rounded ${
                                        hasEnough ? 'bg-green-50' : 'bg-red-50'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2 flex-1">
                                        <Package className={`w-3 h-3 ${hasEnough ? 'text-green-600' : 'text-red-600'}`} />
                                        <span className={`font-medium ${hasEnough ? 'text-green-900' : 'text-red-900'}`}>
                                          {consumable.item_name}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <p className={`font-semibold ${hasEnough ? 'text-green-700' : 'text-red-700'}`}>
                                          Need: {requiredForQty} {consumable.unit}
                                        </p>
                                        <p className="text-gray-600">
                                          Available: {consumable.available_stock} {consumable.unit}
                                        </p>
                                        <p className="text-gray-500 text-xs mt-0.5">
                                          (Max {maxPossible} tests possible)
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {stockInfo.can_perform && (
                                <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                                  <p className="text-blue-800 font-medium">
                                    Maximum tests possible with current stock: <span className="font-bold">{stockInfo.max_tests_possible}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {stockInfo && stockInfo.consumables.length === 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-500 italic">No recipe defined for this test</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-blue-200">
                    <p className="text-base text-gray-700 font-medium">
                      {selectedTestIds.length} test{selectedTestIds.length !== 1 ? 's' : ''} • Total: <span className="font-bold text-blue-700">{formatCurrency(
                        selectedTestIds.reduce((sum, testId) => {
                          const test = tests.find((t) => t.id === testId);
                          const qty = parseInt(testQuantities[testId] || '1');
                          return sum + (test ? test.price * qty : 0);
                        }, 0)
                      )}</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestDialog(false);
                    setSelectedTestIds([]);
                    setTestQuantities({});
                    setTestSearchTerm('');
                    setTestStockInfo(new Map());
                  }}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedTestIds.length === 0}
                  className={`px-6 py-3 rounded-lg font-medium shadow-sm transition-all ${
                    selectedTestIds.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                  }`}
                >
                  Add {selectedTestIds.length > 0 ? `${selectedTestIds.length} Test${selectedTestIds.length !== 1 ? 's' : ''}` : 'Tests'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMedicineDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Dispense Medicine</h2>
            <form onSubmit={handleAddMedicine} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Medicine <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={medicineForm.item_id}
                  onChange={(e) => {
                    const selectedMedicine = medicines.find(m => m.id === e.target.value);
                    setMedicineForm({
                      ...medicineForm,
                      item_id: e.target.value,
                      unit: selectedMedicine?.unit || ''
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select medicine</option>
                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name} - {formatCurrency(medicine.sell_price)} ({medicine.qty_on_hand}{' '}
                      {medicine.unit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={medicineForm.unit}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-100 text-gray-700 cursor-not-allowed"
                    placeholder="Select medicine first"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={medicineForm.qty}
                    onChange={(e) => setMedicineForm({ ...medicineForm, qty: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Instructions</label>
                <textarea
                  value={medicineForm.instructions}
                  onChange={(e) =>
                    setMedicineForm({ ...medicineForm, instructions: e.target.value })
                  }
                  rows={3}
                  placeholder="e.g., Take twice daily after meals"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowMedicineDialog(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm hover:shadow-md transition-all"
                >
                  Add Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDiagnosisModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Diagnosis</h2>
              <button
                onClick={() => setShowDiagnosisModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                {formData.diagnosis || 'No diagnosis entered'}
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDiagnosisModal(false)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow-md transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Confirm Save Visit</h2>
            <p className="text-gray-600 mb-2">
              Are you sure you want to save this visit for <span className="font-semibold text-gray-900">{selectedPatient?.name}</span>?
            </p>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Tests:</span>
                  <span className="font-semibold">{visitTests.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Medicines:</span>
                  <span className="font-semibold">{visitMedicines.length}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-300">
                  <span className="text-gray-700 font-medium">Total Amount:</span>
                  <span className="font-bold text-blue-700">{formatCurrency(calculateTotals().total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">Amount Paid:</span>
                  <span className="font-bold text-green-700">{formatCurrency(calculateTotals().paid)}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6 italic">
              This action will update inventory and cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVisit}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm hover:shadow-md transition-all"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
