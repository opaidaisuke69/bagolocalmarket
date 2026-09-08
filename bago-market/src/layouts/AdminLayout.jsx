import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Users, UserCheck, Package, CheckSquare, ShoppingBag, Tag, BarChart3, Activity, AlertTriangle, Bell, Settings, Menu, X, LogOut, Shield, User, Truck, ArrowUpFromLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/images/logo.png';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: '/admin',                    icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/sellers',            icon: UserCheck,       label: 'Seller Credentials' },
    { path: '/admin/seller-applications',icon: UserCheck,       label: 'Seller Applications' },
    { path: '/admin/riders',             icon: Truck,           label: 'Riders' },
    { path: '/admin/buyers',             icon: Users,           label: 'Buyers' },
    { path: '/admin/products',           icon: Package,         label: 'Products' },
    { path: '/admin/product-approvals',  icon: CheckSquare,     label: 'Product Approvals' },
    { path: '/admin/orders',             icon: ShoppingBag,     label: 'Orders' },
    { path: '/admin/commissions',        icon: BarChart3,       label: 'Commission Report' },
    { path: '/admin/remittances',        icon: ArrowUpFromLine, label: 'Remittances' },
    { path: '/admin/categories',         icon: Tag,             label: 'Categories' },
    { path: '/admin/activities',         icon: Activity,        label: 'Activities' },
    { path: '/admin/warnings',           icon: AlertTriangle,   label: 'Warnings & Bans' },
    { path: '/admin/settings',           icon: Settings,        label: 'Settings' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-primary-900 text-white transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
            <img src={logoImg} alt="Bago Market" className="h-8 w-auto" />
            <div>
              <h1 className="font-bold text-sm">Admin Panel</h1>
              <p className="text-[11px] text-white/60">Bago City Market</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
            {menuItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'bg-white/15 text-accent-400'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center">
                <Shield size={18} className="text-red-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-[11px] text-white/50">Administrator</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/60 hover:text-white w-full px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                <Menu size={20} />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {menuItems.find(m => isActive(m.path))?.label || 'Admin Panel'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell size={20} className="text-gray-600" />
              </button>
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User size={16} className="text-primary-800" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
