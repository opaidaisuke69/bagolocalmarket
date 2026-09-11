import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Home, Search, ShoppingCart, Package, User, Heart, Menu, X, LogOut, Sparkles, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import logoImg from '../assets/images/logo.png';

/* Helper: resolve an image path from the server to a usable URL.
   Vite proxy maps /uploads → XAMPP in dev. In prod it's same-origin.
   No origin manipulation needed — just ensure a leading slash. */
function resolveImg(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function BuyerLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);

  const navLinks = [
    { path: '/',               icon: Home,    label: 'Home'        },
    { path: '/marketplace',    icon: Store,   label: 'Marketplace' },
    { path: '/recommendations',icon: Sparkles,label: 'For You'     },
    { path: '/orders',         icon: Package, label: 'Orders'      },
    { path: '/wishlist',       icon: Heart,   label: 'Wishlist'    },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Pre-fill search box with the current ?search= param when on the marketplace page
  useEffect(() => {
    if (location.pathname === '/marketplace') {
      const params = new URLSearchParams(location.search);
      setSearchValue(params.get('search') || '');
    } else {
      setSearchValue('');
    }
  }, [location.pathname, location.search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchValue.trim();
    if (q) {
      navigate(`/marketplace?search=${encodeURIComponent(q)}`);
    } else {
      navigate('/marketplace');
    }
    searchInputRef.current?.blur();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <header className="bg-primary-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src={logoImg} alt="Bago Shop Express" className="h-9 w-auto" />
              <span className="font-bold text-lg hidden sm:block">Bago Shop Express</span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8">
              <form onSubmit={handleSearchSubmit} className="flex w-full shadow-sm">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  placeholder="Search products..."
                  aria-label="Search products"
                  className="flex-1 px-4 py-2 rounded-l-xl bg-white/90 text-gray-900 text-sm outline-none border-0 focus:ring-2 focus:ring-accent-400 focus:ring-inset placeholder-gray-400 transition-all"
                />
                <button
                  type="submit"
                  aria-label="Submit search"
                  className="px-4 bg-accent-400 hover:bg-accent-300 rounded-r-xl transition-colors flex items-center justify-center shrink-0"
                >
                  <Search size={16} className="text-primary-900" />
                </button>
              </form>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <Link to="/cart" className="relative p-2 hover:bg-white/10 rounded-lg transition-colors">
                <ShoppingCart size={22} />
                {cart.item_count > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-400 text-primary-900 text-xs font-bold rounded-full flex items-center justify-center">
                    {cart.item_count}
                  </span>
                )}
              </Link>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {/* Avatar: show profile photo if available, else initials */}
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-accent-400 flex items-center justify-center shrink-0">
                    {resolveImg(user?.profile_image) ? (
                      <img
                        src={resolveImg(user.profile_image)}
                        alt={user.full_name}
                        className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <span className={`text-primary-900 font-bold text-sm ${resolveImg(user?.profile_image) ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}>
                      {(user?.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden lg:block text-sm font-medium truncate max-w-24">
                    {user?.full_name?.split(' ')[0]}
                  </span>
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-12 w-60 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                      {/* User header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-blue-50 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary-800 flex items-center justify-center shrink-0">
                            {resolveImg(user?.profile_image) ? (
                              <img
                                src={resolveImg(user.profile_image)}
                                alt={user?.full_name}
                                className="w-full h-full object-cover"
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span className="text-white font-bold text-sm">
                                {(user?.full_name || 'U').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{user?.full_name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">
                              {user?.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <User size={15} className="text-gray-400" /> My Profile
                        </Link>
                        <Link to="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Package size={15} className="text-gray-400" /> My Orders
                        </Link>
                        <Link to="/wishlist" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Heart size={15} className="text-gray-400" /> Wishlist
                        </Link>
                        <Link to="/recommendations" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Sparkles size={15} className="text-gray-400" /> For You
                        </Link>
                      </div>

                      <div className="border-t border-gray-100 py-1">
                        <button onClick={handleLogout} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full transition-colors">
                          <LogOut size={15} /> Log Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 hover:bg-white/10 rounded-lg">
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="md:hidden bg-primary-800 px-4 pb-3">
        <form onSubmit={handleSearchSubmit} className="flex shadow-sm">
          <input
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="flex-1 px-4 py-2 rounded-l-xl bg-white/90 text-gray-900 text-sm outline-none border-0 focus:ring-2 focus:ring-accent-400 focus:ring-inset placeholder-gray-400 transition-all"
          />
          <button
            type="submit"
            aria-label="Submit search"
            className="px-4 bg-accent-400 hover:bg-accent-300 rounded-r-xl transition-colors flex items-center justify-center shrink-0"
          >
            <Search size={16} className="text-primary-900" />
          </button>
        </form>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b shadow-lg fixed top-[108px] inset-x-0 z-40">
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.path) ? 'bg-primary-50 text-primary-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <link.icon size={20} />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-40">
        <div className="flex items-center justify-around py-2">
          {[
            { path: '/',           icon: Home,         label: 'Home'    },
            { path: '/marketplace',icon: Search,       label: 'Search'  },
            { path: '/cart',       icon: ShoppingCart, label: 'Cart',  badge: cart.item_count },
            { path: '/orders',     icon: Package,      label: 'Orders'  },
            { path: '/profile',    icon: User,         label: 'Profile' },
          ].map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 relative ${
                isActive(item.path) ? 'text-primary-800' : 'text-gray-500'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-1 right-0 w-4 h-4 bg-accent-400 text-primary-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
