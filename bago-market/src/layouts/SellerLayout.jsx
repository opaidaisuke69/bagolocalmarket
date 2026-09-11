import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, PlusCircle, ShoppingBag, Truck, BarChart3,
  Bell, Settings, Menu, X, LogOut, User, ClipboardList, Wallet,
  ChevronRight, Store, Boxes,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sellerAPI, notificationsAPI, ordersAPI } from '../api/services';
import logoImg from '../assets/images/logo.png';

/* ── Sidebar sections with grouped nav ───────────────────────────────────── */
const buildNav = (pendingOrders, pickupRequests) => [
  {
    label: 'Overview',
    items: [
      { path: '/seller', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { path: '/seller/products',    icon: Package,    label: 'Products'    },
      { path: '/seller/add-product', icon: PlusCircle, label: 'Add Product' },
      { path: '/seller/inventory',   icon: Boxes,      label: 'Inventory'   },
    ],
  },
  {
    label: 'Sales',
    items: [
      { path: '/seller/orders',   icon: ShoppingBag, label: 'Orders',   badge: pendingOrders  || null },
      { path: '/seller/shipping', icon: Truck,       label: 'Shipping', badge: pickupRequests || null },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/seller/reports',    icon: BarChart3, label: 'Reports'         },
      { path: '/seller/remittance', icon: Wallet,    label: 'Payout Accounts' },
    ],
  },
  {
    label: 'Account',
    items: [
      { path: '/seller/settings', icon: Settings, label: 'Store Settings' },
    ],
  },
];

/* ── flat list for topbar label lookup — built inside component from buildNav ── */

export default function SellerLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();

  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [notifCount,     setNotifCount]     = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications,  setNotifications]  = useState([]);
  const [storeName,      setStoreName]      = useState('');
  const [storeAvatar,    setStoreAvatar]    = useState(null);
  const [pendingOrders,  setPendingOrders]  = useState(0);
  const [pickupRequests, setPickupRequests] = useState(0);

  /* exact match for root, prefix match for children */
  const isActive = (path) =>
    path === '/seller'
      ? location.pathname === '/seller'
      : location.pathname.startsWith(path);

  const NAV_SECTIONS = buildNav(pendingOrders, pickupRequests);
  const ALL_ITEMS    = NAV_SECTIONS.flatMap(s => s.items);
  const currentLabel = ALL_ITEMS.find(m => isActive(m.path))?.label || 'Seller Center';

  /* ── fetch notification count ─────────────────────────────────────────── */
  const fetchNotifs = async () => {
    try {
      const res = await notificationsAPI.list({ limit: 10, unread_only: 1 });
      const list = res.data?.notifications || [];
      setNotifCount(list.length);
      setNotifications(list);
    } catch { /* silent */ }
  };

  /* ── fetch pending orders count for sidebar badge ─────────────────────── */
  const fetchPendingOrders = async () => {
    try {
      const res = await ordersAPI.list({ status: 'pending', page: 1, limit: 1 });
      setPendingOrders(res.data?.total || 0);
    } catch { /* silent */ }
  };

  /* ── fetch pickup request count for sidebar badge ──────────────────────── */
  const fetchPickupRequests = async () => {
    try {
      const res = await sellerAPI.pickupRequests();
      setPickupRequests((res.data?.requests || []).length);
    } catch { /* silent */ }
  };

  /* ── fetch store info for sidebar avatar ─────────────────────────────── */
  const fetchStore = async () => {
    try {
      const res = await sellerAPI.dashboard();
      const p = res.data?.stats?.profile || user?.profile;
      if (p) {
        setStoreName(p.store_name || '');
        setStoreAvatar(p.store_logo || null);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchNotifs();
    fetchStore();
    fetchPendingOrders();
    fetchPickupRequests();
    const id = setInterval(() => {
      fetchNotifs();
      fetchPendingOrders();
      fetchPickupRequests();
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const markAllRead = async () => {
    try { await notificationsAPI.markRead({ mark_all: true }); setNotifCount(0); setNotifications([]); }
    catch { /* silent */ }
  };

  /* ── Sidebar link component ────────────────────────────────────────────── */
  const NavLink = ({ item }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
          active
            ? 'bg-white text-primary-900 shadow-sm'
            : 'text-white/65 hover:bg-white/10 hover:text-white'
        }`}
      >
        <item.icon size={17} className={active ? 'text-primary-800' : ''} />
        <span className="flex-1">{item.label}</span>

        {/* Pending orders badge */}
        {item.badge > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}

        {/* Active dot */}
        {active && !item.badge && (
          <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary-800" />
        )}
      </Link>
    );
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════════════════ */}
      <aside
        style={{ background: 'linear-gradient(160deg, #0D0B61 0%, #112E81 45%, #133458 100%)' }}
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 flex flex-col
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          shadow-2xl lg:shadow-none
        `}
      >

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            <img src={logoImg} alt="logo" className="h-7 w-auto object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">Seller Center</p>
            <p className="text-white/40 text-[11px]">Bago Shop Express</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Store identity strip */}
        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 bg-white/8 rounded-xl px-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {storeAvatar
                ? <img src={storeAvatar} alt="store" className="w-full h-full object-cover" />
                : <Store size={16} className="text-white/70" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {storeName || user?.profile?.store_name || 'My Store'}
              </p>
              <p className="text-white/40 text-[10px] truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink key={item.path} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* ── Topbar ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 px-4 lg:px-6 h-16 flex items-center justify-between shrink-0">

          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition"
            >
              <Menu size={20} className="text-gray-600" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-400 hidden sm:block">Seller Center</span>
              <ChevronRight size={13} className="text-gray-300 hidden sm:block" />
              <span className="font-semibold text-gray-900">{currentLabel}</span>
            </div>
          </div>

          {/* Right: search + notif + avatar */}
          <div className="flex items-center gap-2">

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifPanel(v => !v)}
                className="relative p-2.5 hover:bg-gray-100 rounded-xl transition"
              >
                <Bell size={19} className="text-gray-600" />
                {notifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>

              {/* Notification panel */}
              {showNotifPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <p className="font-semibold text-sm text-gray-900">Notifications</p>
                    {notifCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary-800 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">
                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                        No new notifications
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-gray-50 transition">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleString('en-PH', {
                            month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true,
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar */}
            <Link to="/seller/settings"
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl transition"
            >
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                {user?.profile_image
                  ? <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                  : <User size={14} className="text-primary-700" />}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
                {user?.full_name}
              </span>
            </Link>
          </div>
        </header>

        {/* ── Page content ────────────────────────────────────────────── */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
