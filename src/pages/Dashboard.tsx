import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/currency';
import { formatDate } from '../lib/dateFormat';
import { getTodayStart, getDateStart, getDateEnd } from '../lib/timezone';
import { Users, FlaskConical, AlertTriangle, TrendingUp } from 'lucide-react';

interface Stats {
  todayVisits: number;
  totalPatients: number;
  lowStockItems: number;
  todayRevenue: number;
  pendingTests: number;
  inProgressTests: number;
  completedTestsToday: number;
}

interface RevenueData {
  date: string;
  revenue: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    todayVisits: 0,
    totalPatients: 0,
    lowStockItems: 0,
    todayRevenue: 0,
    pendingTests: 0,
    inProgressTests: 0,
    completedTestsToday: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadRevenueChart();

    if (profile?.role === 'lab_tech') {
      const channel = supabase
        .channel('visit_tests_stats')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visit_tests'
          },
          () => {
            loadStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    if (profile?.role === 'admin' || profile?.role === 'doctor') {
      const visitsChannel = supabase
        .channel('visits_stats')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'visits'
          },
          () => {
            loadStats();
            loadRevenueChart();
          }
        )
        .subscribe();

      const inventoryChannel = supabase
        .channel('inventory_stats')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory_items'
          },
          () => {
            loadStats();
          }
        )
        .subscribe();

      const patientsChannel = supabase
        .channel('patients_stats')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'patients'
          },
          () => {
            loadStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(visitsChannel);
        supabase.removeChannel(inventoryChannel);
        supabase.removeChannel(patientsChannel);
      };
    }
  }, [profile]);

  async function loadStats() {
    try {
      const todayStart = getTodayStart();

      if (profile?.role === 'lab_tech') {
        const [pendingRes, inProgressRes, completedRes] = await Promise.all([
          supabase
            .from('visit_tests')
            .select('*', { count: 'exact', head: true })
            .eq('results_status', 'pending'),
          supabase
            .from('visit_tests')
            .select('*', { count: 'exact', head: true })
            .eq('results_status', 'in_progress'),
          supabase
            .from('visit_tests')
            .select('*', { count: 'exact', head: true })
            .eq('results_status', 'completed')
            .gte('results_entered_at', todayStart),
        ]);

        if (pendingRes.error) console.error('Pending tests error:', pendingRes.error);
        if (inProgressRes.error) console.error('In progress tests error:', inProgressRes.error);
        if (completedRes.error) console.error('Completed tests error:', completedRes.error);

        setStats({
          todayVisits: 0,
          totalPatients: 0,
          lowStockItems: 0,
          todayRevenue: 0,
          pendingTests: pendingRes.count || 0,
          inProgressTests: inProgressRes.count || 0,
          completedTestsToday: completedRes.count || 0,
        });
      } else {
        const [todayPatientsRes, patientsRes, inventoryRes, revenueRes] = await Promise.all([
          supabase
            .from('visits')
            .select('patient_id')
            .gte('created_at', todayStart)
            .limit(10000),
          supabase.from('patients').select('*', { count: 'exact', head: true }),
          supabase
            .from('inventory_items')
            .select('qty_on_hand, reorder_level')
            .limit(10000),
          supabase
            .from('visits')
            .select('total')
            .gte('created_at', todayStart)
            .limit(10000),
        ]);

        if (todayPatientsRes.error) console.error('Today patients error:', todayPatientsRes.error);
        if (patientsRes.error) console.error('Patients error:', patientsRes.error);
        if (inventoryRes.error) console.error('Inventory error:', inventoryRes.error);
        if (revenueRes.error) console.error('Revenue error:', revenueRes.error);

        const uniquePatientIds = new Set(todayPatientsRes.data?.map(v => v.patient_id) || []);
        const todayPatientsCount = uniquePatientIds.size;

        const lowStockItems = inventoryRes.data?.filter(
          item => item.qty_on_hand <= item.reorder_level
        ).length || 0;

        const todayRevenue = revenueRes.data?.reduce((sum, v) => sum + Number(v.total), 0) || 0;

        setStats({
          todayVisits: todayPatientsCount,
          totalPatients: patientsRes.count || 0,
          lowStockItems,
          todayRevenue,
          pendingTests: 0,
          inProgressTests: 0,
          completedTestsToday: 0,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRevenueChart() {
    try {
      const days = 7;
      const chartData: RevenueData[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const dayStart = getDateStart(date);
        const dayEnd = getDateEnd(date);

        const { data } = await supabase
          .from('visits')
          .select('total')
          .gte('created_at', dayStart)
          .lt('created_at', dayEnd);

        const revenue = data?.reduce((sum, v) => sum + Number(v.total), 0) || 0;

        const dateStr = formatDate(date);
        const [dayNum, monthNum] = dateStr.split('/');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[parseInt(monthNum) - 1];

        chartData.push({
          date: `${dayNum} ${monthName}`,
          revenue,
        });
      }

      setRevenueData(chartData);
    } catch (error) {
      console.error('Error loading revenue chart:', error);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Dashboard
        </h1>
        <p className="text-slate-600 font-medium">Overview of your laboratory operation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {profile?.role === 'doctor' && (
          <StatCard
            title="Today's Patients"
            value={stats.todayVisits}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
        )}

        {profile?.role === 'admin' && (
          <>
            <StatCard
              title="Today's Patients"
              value={stats.todayVisits}
              icon={<Users className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              title="Total Patients"
              value={stats.totalPatients}
              icon={<Users className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Today's Revenue"
              value={formatCurrency(stats.todayRevenue)}
              icon={<TrendingUp className="w-6 h-6" />}
              color="purple"
            />
            <StatCard
              title="Low Stock Items"
              value={stats.lowStockItems}
              icon={<AlertTriangle className="w-6 h-6" />}
              color="red"
            />
          </>
        )}

        {profile?.role === 'lab_tech' && (
          <>
            <StatCard
              title="Pending Tests"
              value={stats.pendingTests}
              icon={<FlaskConical className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              title="In Progress"
              value={stats.inProgressTests}
              icon={<FlaskConical className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Completed Today"
              value={stats.completedTestsToday}
              icon={<FlaskConical className="w-6 h-6" />}
              color="purple"
            />
          </>
        )}
      </div>

      {profile?.role === 'admin' && (
        <div className="bg-white rounded-2xl shadow-card p-8 border border-slate-200/50 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Revenue Trend (Last 7 Days)</h2>
          <RevenueChart data={revenueData} />
        </div>
      )}

      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-card p-8 border border-slate-200/50">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Welcome back, {profile?.name}!</h2>
        <p className="text-slate-600 font-medium leading-relaxed">
          {profile?.role === 'admin'
            ? 'Use the sidebar to manage patients, visits, inventory, tests, reports, users, and settings.'
            : profile?.role === 'lab_tech'
            ? 'Use the sidebar to view and enter lab test results for tests ordered by doctors.'
            : 'Use the sidebar to view patients, create visits, and manage consultations.'}
        </p>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'purple';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      shadow: 'shadow-blue-500/20',
      border: 'border-blue-100',
    },
    green: {
      bg: 'bg-gradient-to-br from-green-500 to-green-600',
      shadow: 'shadow-green-500/20',
      border: 'border-green-100',
    },
    red: {
      bg: 'bg-gradient-to-br from-red-500 to-red-600',
      shadow: 'shadow-red-500/20',
      border: 'border-red-100',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      shadow: 'shadow-purple-500/20',
      border: 'border-purple-100',
    },
  };

  const isCurrency = typeof value === 'string' && value.startsWith('TSh');
  const fontSizeClass = isCurrency ? 'text-lg' : 'text-2xl';

  return (
    <div className={`bg-white rounded-2xl shadow-card p-6 border ${colorClasses[color].border} hover:shadow-soft transition-all duration-300 hover:-translate-y-1`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color].bg} ${colorClasses[color].shadow} p-3.5 rounded-xl text-white shadow-lg`}>
          {icon}
        </div>
      </div>
      <h3 className="text-slate-600 text-sm font-semibold mb-2 tracking-wide uppercase">{title}</h3>
      <p className={`${fontSizeClass} font-bold text-slate-900`}>{value}</p>
    </div>
  );
}

interface RevenueChartProps {
  data: RevenueData[];
}

function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return <div className="text-center py-12 text-slate-500">No data available</div>;
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const chartHeight = 200;
  const chartWidth = 100;
  const padding = 10;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = chartHeight - (d.revenue / maxRevenue) * (chartHeight - padding * 2) - padding;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-48"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <polygon
          points={areaPoints}
          fill="url(#revenueGradient)"
          className="transition-all duration-500"
        />

        <polyline
          points={points}
          fill="none"
          stroke="rgb(139, 92, 246)"
          strokeWidth="0.5"
          className="transition-all duration-500"
        />

        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * chartWidth;
          const y = chartHeight - (d.revenue / maxRevenue) * (chartHeight - padding * 2) - padding;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="0.8"
              fill="rgb(139, 92, 246)"
              className="transition-all duration-500 hover:r-1.2"
            />
          );
        })}
      </svg>

      <div className="flex justify-between mt-4 px-2">
        {data.map((d, i) => (
          <div key={i} className="text-center flex-1">
            <p className="text-xs text-slate-500 mb-1">{d.date}</p>
            <p className="text-sm font-semibold text-slate-700">
              {d.revenue > 0 ? formatCurrency(d.revenue) : '-'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
