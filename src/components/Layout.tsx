import { ReactNode, useState } from 'react';
import { useAuth } from '../lib/auth';
import NotificationsDropdown from './NotificationsDropdown';
import {
  LayoutDashboard,
  Users,
  Package,
  FlaskConical,
  ClipboardList,
  BarChart3,
  LogOut,
  Menu,
  X,
  Stethoscope,
  User,
  Settings,
  ShoppingCart,
  History,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const doctorMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'visits', label: 'New Visit', icon: ClipboardList },
    { id: 'visit-history', label: 'Visit History', icon: History },
    { id: 'test-results', label: 'Test Results', icon: FlaskConical },
  ];

  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'visits', label: 'New Visit', icon: ClipboardList },
    { id: 'visit-history', label: 'Visit History', icon: History },
    { id: 'lab-results', label: 'Lab Results', icon: FlaskConical },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
    { id: 'tests', label: 'Tests Management', icon: Settings },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const labTechMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lab-results', label: 'Lab Results', icon: FlaskConical },
  ];

  const menu =
    profile?.role === 'admin' ? adminMenu :
    profile?.role === 'lab_tech' ? labTechMenu :
    doctorMenu;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex h-screen overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } no-print fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0 shadow-2xl`}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-white tracking-tight">Remtullah Medical</h1>
                  <p className="text-xs text-slate-400 font-medium">Laboratory</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <nav className="space-y-1.5">
                {menu.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                        currentPage === item.id
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white hover:scale-[1.02]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
              <div className="flex items-center space-x-3 mb-3 px-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg">
                  {profile?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{profile?.name}</p>
                  <p className="text-xs text-slate-400 capitalize font-medium">
                    {profile?.role === 'lab_tech' ? 'Lab Tech' : profile?.role}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all duration-200 border border-red-500/20 hover:border-red-500/40"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="no-print bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setSidebarOpen(true)} className="text-gray-700 hover:text-gray-900 lg:hidden">
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent lg:hidden">Remtullah Medical</h1>
              <div className="hidden lg:block flex-1"></div>
              {(profile?.role === 'doctor' || profile?.role === 'admin') && (
                <NotificationsDropdown />
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
