import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { formatDate, formatDateTime, getDateDaysAgo, getTodayDateString } from '../lib/dateFormat';
import { getTodayStart } from '../lib/timezone';
import { TrendingUp, Package, Activity, ShoppingCart, DollarSign, PieChart, Users } from 'lucide-react';
import Pagination from '../components/Pagination';

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: getDateDaysAgo(30),
    end: getTodayDateString(),
  });

  const [salesData, setSalesData] = useState({
    totalRevenue: 0,
    todayRevenue: 0,
    testRevenue: 0,
    medicineRevenue: 0,
    visitCount: 0,
    patientCount: 0,
  });

  const [topTests, setTopTests] = useState<Array<{ name: string; count: number; revenue: number }>>([]);
  const [topMedicines, setTopMedicines] = useState<Array<{ name: string; qty: number; revenue: number }>>([]);
  const [lowStock, setLowStock] = useState<Array<{ name: string; qty: number; reorder: number; type: string }>>([]);
  const [movements, setMovements] = useState<Array<{
    item_name: string;
    movement_type: string;
    qty: number;
    reason: string;
    created_at: string;
    user_name: string;
  }>>([]);

  const [purchaseData, setPurchaseData] = useState({
    totalAmount: 0,
    purchaseCount: 0,
    medicineAmount: 0,
    consumableAmount: 0,
  });

  const [topSuppliers, setTopSuppliers] = useState<Array<{ supplier: string; amount: number; count: number }>>([]);
  const [recentPurchases, setRecentPurchases] = useState<Array<{
    purchase_date: string;
    item_name: string;
    supplier: string;
    quantity: number;
    total_amount: number;
    item_type: string;
  }>>([]);

  const [profitData, setProfitData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    grossProfit: 0,
    profitMargin: 0,
    testRevenue: 0,
    medicineRevenue: 0,
    medicineCOGS: 0,
    consumableCosts: 0,
    medicineProfit: 0,
    testProfit: 0,
    medicineProfitMargin: 0,
    testProfitMargin: 0,
  });

  const [topProfitableTests, setTopProfitableTests] = useState<Array<{
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    count: number;
  }>>([]);

  const [topProfitableMedicines, setTopProfitableMedicines] = useState<Array<{
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    qty: number;
  }>>([]);

  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'purchases' | 'profit'>('sales');
  const [lowStockPage, setLowStockPage] = useState(1);
  const lowStockItemsPerPage = 5;

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  async function loadReports() {
    await Promise.all([
      loadSalesData(),
      loadTopTests(),
      loadTopMedicines(),
      loadLowStock(),
      loadStockMovements(),
      loadPurchaseData(),
      loadTopSuppliers(),
      loadRecentPurchases(),
      loadProfitData(),
      loadTopProfitableTests(),
      loadTopProfitableMedicines(),
    ]);
  }

  async function loadSalesData() {
    try {
      const [summaryRes, patientRes, todayVisitsRes] = await Promise.all([
        supabase.rpc('get_sales_summary', { start_date: dateRange.start, end_date: dateRange.end }),
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('visits').select('total').gte('created_at', getTodayStart()),
      ]);

      const summary = summaryRes.data || {};
      const todayRevenue = (todayVisitsRes.data || []).reduce((sum: number, v: any) => sum + Number(v.total), 0);

      setSalesData({
        totalRevenue: summary.total_revenue || 0,
        todayRevenue,
        testRevenue: summary.test_revenue || 0,
        medicineRevenue: summary.medicine_revenue || 0,
        visitCount: summary.visit_count || 0,
        patientCount: patientRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading sales data:', error);
    }
  }

  async function loadTopTests() {
    try {
      const { data } = await supabase.rpc('get_top_tests', {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit_count: 5,
      });
      setTopTests(data || []);
    } catch (error) {
      console.error('Error loading top tests:', error);
    }
  }

  async function loadTopMedicines() {
    try {
      const { data } = await supabase.rpc('get_top_medicines', {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit_count: 5,
      });
      setTopMedicines(data || []);
    } catch (error) {
      console.error('Error loading top medicines:', error);
    }
  }

  async function loadLowStock() {
    try {
      const { data } = await supabase.rpc('get_low_stock_items');
      setLowStock(data || []);
    } catch (error) {
      console.error('Error loading low stock:', error);
    }
  }

  async function loadStockMovements() {
    try {
      const { data } = await supabase
        .from('stock_movements')
        .select(`
          qty,
          movement_type,
          reason,
          created_at,
          inventory_items(name),
          users(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      setMovements(data?.map((m: any) => ({
        item_name: m.inventory_items.name,
        movement_type: m.movement_type,
        qty: m.qty,
        reason: m.reason,
        created_at: m.created_at,
        user_name: m.users.name,
      })) || []);
    } catch (error) {
      console.error('Error loading stock movements:', error);
    }
  }

  async function loadPurchaseData() {
    try {
      const { data: purchases } = await supabase
        .from('purchases')
        .select('id, total_amount')
        .gte('purchase_date', dateRange.start)
        .lte('purchase_date', dateRange.end + 'T23:59:59')
        .eq('status', 'completed');

      if (!purchases || purchases.length === 0) {
        setPurchaseData({
          totalAmount: 0,
          purchaseCount: 0,
          medicineAmount: 0,
          consumableAmount: 0,
        });
        return;
      }

      const purchaseIds = purchases.map(p => p.id);

      const { data: items } = await supabase
        .from('purchase_items')
        .select('total_amount, inventory_items(type)')
        .in('purchase_id', purchaseIds);

      if (!items) {
        setPurchaseData({
          totalAmount: purchases.reduce((sum, p) => sum + Number(p.total_amount), 0),
          purchaseCount: purchases.length,
          medicineAmount: 0,
          consumableAmount: 0,
        });
        return;
      }

      const medicineAmount = items
        .filter((item: any) => item.inventory_items?.type === 'medicine')
        .reduce((sum, item) => sum + Number(item.total_amount), 0);
      const consumableAmount = items
        .filter((item: any) => item.inventory_items?.type === 'lab_consumable')
        .reduce((sum, item) => sum + Number(item.total_amount), 0);

      setPurchaseData({
        totalAmount: purchases.reduce((sum, p) => sum + Number(p.total_amount), 0),
        purchaseCount: purchases.length,
        medicineAmount,
        consumableAmount,
      });
    } catch (error) {
      console.error('Error loading purchase data:', error);
    }
  }

  async function loadTopSuppliers() {
    try {
      const { data } = await supabase.rpc('get_top_suppliers', {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit_count: 5,
      });
      setTopSuppliers(data || []);
    } catch (error) {
      console.error('Error loading top suppliers:', error);
    }
  }

  async function loadRecentPurchases() {
    try {
      const { data: purchases } = await supabase
        .from('purchases')
        .select('id, purchase_date, supplier')
        .gte('purchase_date', dateRange.start)
        .lte('purchase_date', dateRange.end + 'T23:59:59')
        .eq('status', 'completed')
        .order('purchase_date', { ascending: false })
        .limit(20);

      if (!purchases || purchases.length === 0) {
        setRecentPurchases([]);
        return;
      }

      const purchaseIds = purchases.map(p => p.id);

      const { data: items } = await supabase
        .from('purchase_items')
        .select(`
          purchase_id,
          quantity,
          total_amount,
          inventory_items(name, type)
        `)
        .in('purchase_id', purchaseIds);

      if (!items) {
        setRecentPurchases([]);
        return;
      }

      const purchaseMap = purchases.reduce((acc: any, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const recentItems = items.map((item: any) => {
        const purchase = purchaseMap[item.purchase_id];
        return {
          purchase_date: purchase.purchase_date,
          item_name: item.inventory_items?.name || 'Unknown',
          supplier: purchase.supplier,
          quantity: item.quantity,
          total_amount: item.total_amount,
          item_type: item.inventory_items?.type || 'unknown',
        };
      }).slice(0, 20);

      setRecentPurchases(recentItems);
    } catch (error) {
      console.error('Error loading recent purchases:', error);
    }
  }

  async function loadProfitData() {
    try {
      const { data } = await supabase.rpc('get_profit_summary', {
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      if (!data) return;
      setProfitData({
        totalRevenue: data.total_revenue || 0,
        totalExpenses: (data.test_cogs || 0) + (data.medicine_cogs || 0),
        grossProfit: data.gross_profit || 0,
        profitMargin: data.profit_margin || 0,
        testRevenue: data.test_revenue || 0,
        medicineRevenue: data.medicine_revenue || 0,
        medicineCOGS: data.medicine_cogs || 0,
        consumableCosts: data.test_cogs || 0,
        medicineProfit: data.medicine_profit || 0,
        testProfit: data.test_profit || 0,
        medicineProfitMargin: data.medicine_profit_margin || 0,
        testProfitMargin: data.test_profit_margin || 0,
      });
    } catch (error) {
      console.error('Error loading profit data:', error);
    }
  }

  async function loadTopProfitableTests() {
    try {
      const { data } = await supabase.rpc('get_top_profitable_tests', {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit_count: 5,
      });
      const result = (data || []).map((item: any) => ({
        ...item,
        margin: item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0,
      }));
      setTopProfitableTests(result);
    } catch (error) {
      console.error('Error loading top profitable tests:', error);
    }
  }

  async function loadTopProfitableMedicines() {
    try {
      const { data } = await supabase.rpc('get_top_profitable_medicines', {
        start_date: dateRange.start,
        end_date: dateRange.end,
        limit_count: 5,
      });
      const result = (data || []).map((item: any) => ({
        ...item,
        margin: item.revenue > 0 ? ((item.profit / item.revenue) * 100) : 0,
      }));
      setTopProfitableMedicines(result);
    } catch (error) {
      console.error('Error loading top profitable medicines:', error);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'sales' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Sales Reports
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'purchases' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Purchase Reports
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Inventory Reports
        </button>
        <button
          onClick={() => setActiveTab('profit')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'profit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          Profit Report
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-blue-800">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(salesData.totalRevenue)}</p>
              <p className="text-xs text-blue-600 mt-1">{dateRange.start} to {dateRange.end}</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl shadow-lg p-6 border-2 border-cyan-200">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-cyan-600" />
              </div>
              <p className="text-sm font-semibold text-cyan-800">Total Patients</p>
              <p className="text-2xl font-bold text-cyan-900">{salesData.patientCount}</p>
              <p className="text-xs text-cyan-600 mt-1">{salesData.visitCount} visits total</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border-2 border-green-200">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-green-800">Today's Revenue</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(salesData.todayRevenue)}</p>
              <p className="text-xs text-green-600 mt-1">{getTodayDateString()}</p>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl shadow-lg p-6 border-2 border-violet-200">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-8 h-8 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-violet-800">Test Revenue</p>
              <p className="text-2xl font-bold text-violet-900">{formatCurrency(salesData.testRevenue)}</p>
              <p className="text-xs text-violet-600 mt-1">
                {salesData.totalRevenue > 0 ? ((salesData.testRevenue / salesData.totalRevenue) * 100).toFixed(1) : 0}% of total
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-lg p-6 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-sm font-semibold text-orange-800">Medicine Revenue</p>
              <p className="text-2xl font-bold text-orange-900">{formatCurrency(salesData.medicineRevenue)}</p>
              <p className="text-xs text-orange-600 mt-1">
                {salesData.totalRevenue > 0 ? ((salesData.medicineRevenue / salesData.totalRevenue) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Top Tests</h2>
              {topTests.length === 0 ? (
                <p className="text-gray-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topTests.map((test, index) => (
                    <div key={index} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{test.name}</p>
                        <p className="text-sm text-gray-600">Ordered: {test.count} times</p>
                      </div>
                      <p className="font-bold text-purple-600">{formatCurrency(test.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Top Medicines</h2>
              {topMedicines.length === 0 ? (
                <p className="text-gray-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topMedicines.map((medicine, index) => (
                    <div key={index} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{medicine.name}</p>
                        <p className="text-sm text-gray-600">Dispensed: {medicine.qty} units</p>
                      </div>
                      <p className="font-bold text-blue-600">{formatCurrency(medicine.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Total Purchases</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(purchaseData.totalAmount)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Purchase Count</p>
              <p className="text-xl font-bold text-gray-900">{purchaseData.purchaseCount}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Medicine Purchases</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(purchaseData.medicineAmount)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Consumable Purchases</p>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(purchaseData.consumableAmount)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Top Suppliers</h2>
              {topSuppliers.length === 0 ? (
                <p className="text-gray-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topSuppliers.map((supplier, index) => (
                    <div key={index} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="font-medium">{supplier.supplier}</p>
                        <p className="text-sm text-gray-600">{supplier.count} purchases</p>
                      </div>
                      <p className="font-bold text-blue-600">{formatCurrency(supplier.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Purchases</h2>
              {recentPurchases.length === 0 ? (
                <p className="text-gray-500">No purchases found</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentPurchases.map((purchase, index) => (
                    <div key={index} className="border-b pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{purchase.item_name}</p>
                          <p className="text-xs text-gray-500">{purchase.supplier}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(purchase.purchase_date)} - Qty: {purchase.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs rounded ${
                            purchase.item_type === 'medicine' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {purchase.item_type === 'medicine' ? 'Medicine' : 'Consumable'}
                          </span>
                          <p className="font-bold text-sm mt-1">{formatCurrency(purchase.total_amount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5 text-red-600" />
              <span>Low Stock Items</span>
            </h2>
            {lowStock.length === 0 ? (
              <p className="text-gray-500">All items are adequately stocked</p>
            ) : (
              <>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Item</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Current Qty</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Reorder Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock
                      .slice((lowStockPage - 1) * lowStockItemsPerPage, lowStockPage * lowStockItemsPerPage)
                      .map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 text-xs rounded ${
                              item.type === 'medicine' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {item.type === 'medicine' ? 'Medicine' : 'Lab Consumable'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-red-600">{item.qty}</td>
                          <td className="px-4 py-2 text-right">{item.reorder}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {lowStock.length > lowStockItemsPerPage && (
                  <Pagination
                    currentPage={lowStockPage}
                    totalPages={Math.ceil(lowStock.length / lowStockItemsPerPage)}
                    onPageChange={setLowStockPage}
                  />
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Recent Stock Movements</span>
            </h2>
            {movements.length === 0 ? (
              <p className="text-gray-500">No stock movements recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Item</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Type</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Reason</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">
                          {formatDate(movement.created_at)}<br/>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(movement.created_at).split(' ')[1]}
                          </span>
                        </td>
                        <td className="px-4 py-2">{movement.item_name}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            movement.movement_type === 'IN' ? 'bg-green-100 text-green-800' :
                            movement.movement_type === 'OUT' ? 'bg-red-100 text-red-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {movement.movement_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{movement.qty}</td>
                        <td className="px-4 py-2 text-sm">{movement.reason}</td>
                        <td className="px-4 py-2 text-sm">{movement.user_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'profit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(profitData.totalRevenue)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-sm text-gray-600">Total COGS</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(profitData.totalExpenses)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Gross Profit</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(profitData.grossProfit)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <PieChart className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Profit Margin</p>
              <p className="text-xl font-bold text-green-600">{profitData.profitMargin.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Revenue Breakdown</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-700">Test Revenue</span>
                  <span className="font-bold text-blue-600">{formatCurrency(profitData.testRevenue)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-700">Medicine Revenue</span>
                  <span className="font-bold text-blue-600">{formatCurrency(profitData.medicineRevenue)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-semibold text-gray-900">Total Revenue</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(profitData.totalRevenue)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Cost of Goods Sold (COGS)</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-700">Medicine COGS</span>
                  <span className="font-bold text-red-600">{formatCurrency(profitData.medicineCOGS)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-700">Test Consumable Costs</span>
                  <span className="font-bold text-red-600">{formatCurrency(profitData.consumableCosts)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-semibold text-gray-900">Total COGS</span>
                  <span className="text-lg font-bold text-red-600">{formatCurrency(profitData.totalExpenses)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border-2 border-green-200">
              <h2 className="text-xl font-semibold mb-4 text-green-800">Medicine Profit Analysis</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Revenue</span>
                  <span className="font-bold text-blue-600">{formatCurrency(profitData.medicineRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Cost of Goods Sold</span>
                  <span className="font-bold text-red-600">{formatCurrency(profitData.medicineCOGS)}</span>
                </div>
                <div className="h-px bg-green-300"></div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-green-800">Net Profit</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(profitData.medicineProfit)}</span>
                </div>
                <div className="flex justify-between items-center bg-green-200 rounded p-2">
                  <span className="font-semibold text-green-800">Profit Margin</span>
                  <span className="text-xl font-bold text-green-700">{profitData.medicineProfitMargin.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border-2 border-blue-200">
              <h2 className="text-xl font-semibold mb-4 text-blue-800">Test Profit Analysis</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Revenue</span>
                  <span className="font-bold text-blue-600">{formatCurrency(profitData.testRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Test Consumable Costs</span>
                  <span className="font-bold text-red-600">{formatCurrency(profitData.consumableCosts)}</span>
                </div>
                <div className="h-px bg-blue-300"></div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-blue-800">Net Profit</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(profitData.testProfit)}</span>
                </div>
                <div className="flex justify-between items-center bg-blue-200 rounded p-2">
                  <span className="font-semibold text-blue-800">Profit Margin</span>
                  <span className="text-xl font-bold text-blue-700">{profitData.testProfitMargin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Top Profitable Tests</h2>
              {topProfitableTests.length === 0 ? (
                <p className="text-gray-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topProfitableTests.map((test, index) => (
                    <div key={index} className="border-b pb-3">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{test.name}</p>
                          <p className="text-sm text-gray-600">Performed: {test.count} times</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(test.profit)}</p>
                          <p className="text-xs text-gray-500">{test.margin.toFixed(1)}% margin</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Revenue: {formatCurrency(test.revenue)}</span>
                        <span>Cost: {formatCurrency(test.cost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Top Profitable Medicines</h2>
              {topProfitableMedicines.length === 0 ? (
                <p className="text-gray-500">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topProfitableMedicines.map((medicine, index) => (
                    <div key={index} className="border-b pb-3">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{medicine.name}</p>
                          <p className="text-sm text-gray-600">Dispensed: {medicine.qty} units</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(medicine.profit)}</p>
                          <p className="text-xs text-gray-500">{medicine.margin.toFixed(1)}% margin</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Revenue: {formatCurrency(medicine.revenue)}</span>
                        <span>Cost: {formatCurrency(medicine.cost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 via-green-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-blue-300">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center space-x-2">
              <PieChart className="w-7 h-7 text-blue-600" />
              <span>Profit Calculation Summary</span>
            </h2>
            <div className="bg-white rounded-lg p-6 shadow-md">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b-2 border-blue-200">
                  <span className="text-lg font-semibold text-gray-800">Total Revenue (Paid)</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(profitData.totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-700 ml-4">• Medicine Revenue</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(profitData.medicineRevenue)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-700 ml-4">• Test Revenue</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(profitData.testRevenue)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b-2 border-red-200 mt-4">
                  <span className="text-lg font-semibold text-gray-800">Total COGS</span>
                  <span className="text-xl font-bold text-red-600">-{formatCurrency(profitData.totalExpenses)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-700 ml-4">• Medicine COGS</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(profitData.medicineCOGS)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-700 ml-4">• Test Consumable Costs</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(profitData.consumableCosts)}</span>
                </div>
                <div className="flex justify-between items-center pt-4 pb-3 border-t-4 border-green-300 bg-green-50 rounded-lg px-4 py-3 mt-4">
                  <span className="text-2xl font-bold text-green-800">Net Profit</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(profitData.grossProfit)}</span>
                </div>
                <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-800">Profit Margin</span>
                    <span className="text-3xl font-bold text-green-700">{profitData.profitMargin.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Calculated as: (Revenue - COGS) / Revenue × 100
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
