import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users, UserCheck, Truck, AlertTriangle,
  Package, ShoppingBag, Tag, CheckSquare,
  BarChart3, ArrowUpFromLine, Wallet,
  Activity, Bell, Menu, X,
  LogOut, Shield, User, ChevronDown, ChevronRight,
  Circle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../api/services';
import logoImg from '../assets/images/logo.png';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    ],
  },
  {
    label: 'People',
    items: [
      { path: '/admin/seller-applications', icon: UserCheck,     label: 'Seller Applications', badge: 'pending_sellers' },
      { path: '/admin/sellers',             icon: UserCheck,     label: 'Seller Credentials' },
      { path: '/admin/riders',              icon: Truck,         label: 'Riders', badge: 'pending_riders' },
      { path: '/admin/buyers',              icon: Users,         label: 'Buyers' },
      { path: '/admin/warnings',            icon: AlertTriangle, label: 'Warnings & Bans' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { path: '/admin/products',         icon: Package,    label: 'All Products' },
      { path: '/admin/product-approvals',icon: CheckSquare,label: 'Product Approvals', badge: 'pending_products' },
      { path: '/admin/orders',           icon: ShoppingBag,label: 'Orders' },
      { path: '/admin/categories',       icon: Tag,        label: 'Categories' },
    ],
  },
  {
    label: 'Financial',
    items: [
      { path: '/admin/commissions',   icon: BarChart3,       label: 'Commission Report' },
      { path: '/admin/remittances',   icon: ArrowUpFromLine, label: 'Remittances' },
      { path: '/admin/seller-payouts',icon: Wallet,          label: 'Seller Payouts' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/admin/activities', icon: Activity, label: 'Activity Log' },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();

  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [collapsed,      setCollapsed]      = useState({});   // group label → bool
  const [badges,         setBadges]         = useState({});   // badge key → number
  const [notifications,  setNotifications]  = useState([]);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [bellOpen,       setBellOpen]       = useState(false);
  const bellRef = useRef(null);

  /* ── fetch badge counts (pending sellers/riders/products) ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminAPI.dashboard();
        const s   = res.data.stats;
        setBadges({
          pending_sellers:  s.pending_sellers  || 0,
          pending_riders:   s.pending_riders   || 0,
          pending_products: s.pending_products || 0,
        });
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  /* ── fetch admin notifications ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminAPI.notifications({ limit: 20 });
        const list = res.data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.is_read).length);
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  /* ── close bell on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (path, exact = false) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const toggleGroup = (label) =>
    setCollapsed(c => ({ ...c, [label]: !c[label] }));

  const handleLogout = () => { logout(); navigate('/'); };

  const markAllRead = async () => {
    try {
      await adminAPI.markNotificationsRead();
      setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  /* active page label for header */
  const activeLabel = (() => {
    for (const g of NAV_GROUPS) {
      for (const item of g.items) {
        if (item.exact ? location.pathname === item.path : location.pathname === item.path)
          return item.label;
      }
    }
    return 'Admin Panel';
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ─────────────── SIDEBAR ─────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col
        w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white
        shadow-2xl transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ height: '100vh' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <img src={logoImg} alt="Logo" className="h-6 w-auto" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight truncate">Bago Shop Express</p>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Admin Console</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-white/10 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Nav — scrollable, hidden scrollbar */}
        <nav
          className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
          {NAV_GROUPS.map(group => {
            const isCollapsed = collapsed[group.label];
            return (
              <div key={group.label} className="mb-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors"
                >
                  <span>{group.label}</span>
                  {isCollapsed
                    ? <ChevronRight size={12} />
                    : <ChevronDown  size={12} />}
                </button>

                {/* Items */}
                {!isCollapsed && group.items.map(item => {
                  const active  = isActive(item.path, item.exact);
                  const badgeN  = item.badge ? badges[item.badge] : 0;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium
                        transition-all duration-150 mb-0.5
                        ${active
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-white/55 hover:bg-white/8 hover:text-white/90'}
                      `}
                    >
                      {/* left accent bar */}
                      <span className={`w-0.5 h-4 rounded-full shrink-0 transition-all ${active ? 'bg-accent-400' : 'bg-transparent group-hover:bg-white/20'}`} />
                      <item.icon size={16} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badgeN > 0 && (
                        <span className="ml-auto shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {badgeN > 99 ? '99+' : badgeN}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="shrink-0 p-3 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 bg-red-500/25 rounded-full flex items-center justify-center shrink-0">
              <Shield size={15} className="text-red-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-white/40">Administrator</p>
            </div>
            <button onClick={handleLogout} title="Logout"
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─────────────── MAIN ─────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">

        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                <Menu size={20} />
              </button>
              <div>
                <h2 className="text-base font-semibold text-gray-900 leading-tight">{activeLabel}</h2>
                <p className="text-xs text-gray-400 hidden sm:block">Bago Shop Express · Admin</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Notification Bell */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setBellOpen(o => !o)}
                  className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Bell dropdown */}
                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                      <span className="text-sm font-semibold text-gray-800">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-700 hover:underline font-medium">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-sm text-gray-400">
                          <Bell size={28} className="mx-auto mb-2 opacity-30" />
                          No notifications yet
                        </div>
                      ) : notifications.map(n => (
                        <div key={n.id}
                          className={`px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/60' : ''}`}>
                          <div className="flex items-start gap-2.5">
                            <Circle size={7}
                              className={`mt-1.5 shrink-0 ${n.is_read ? 'text-gray-300' : 'text-blue-500 fill-blue-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(n.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar */}
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center ml-1">
                <User size={15} className="text-primary-800" />
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
