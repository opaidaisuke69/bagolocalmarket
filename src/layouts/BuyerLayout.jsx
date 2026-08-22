import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, Search, ShoppingCart, Package, User, Heart, Menu, X, Bell, LogOut, Sparkles, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function BuyerLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navLinks = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/marketplace', icon: Store, label: 'Marketplace' },
    { path: '/recommendations', icon: Sparkles, label: 'For You' },
    { path: '/orders', icon: Package, label: 'Orders' },
    { path: '/wishlist', icon: Heart, label: 'Wishlist' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <header className="bg-primary-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-400 rounded-lg flex items-center justify-center">
                <Store size={18} className="text-primary-900" />
              </div>
              <span className="font-bold text-lg hidden sm:block">Bago Market</span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8">
              <Link to="/marketplace" className="flex-1 flex items-center bg-white/10 hover:bg-white/15 rounded-lg px-4 py-2 transition-colors">
                <Search size={18} className="text-white/70 mr-2" />
                <span className="text-white/70 text-sm">Search products...</span>
              </Link>
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

              <button className="relative p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Bell size={22} />
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-accent-400 rounded-full flex items-center justify-center">
                    <User size={16} className="text-primary-900" />
                  </div>
                  <span className="hidden lg:block text-sm font-medium truncate max-w-24">
                    {user?.full_name?.split(' ')[0]}
                  </span>
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border z-50 py-2">
                      <div className="px-4 py-2 border-b">
                        <p className="font-medium text-gray-900 text-sm">{user?.full_name}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <User size={16} /> Profile
                      </Link>
                      <Link to="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <Package size={16} /> My Orders
                      </Link>
                      <Link to="/wishlist" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <Heart size={16} /> Wishlist
                      </Link>
                      <hr className="my-1" />
                      <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full">
                        <LogOut size={16} /> Logout
                      </button>
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b shadow-lg fixed top-16 inset-x-0 z-40">
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
            { path: '/', icon: Home, label: 'Home' },
            { path: '/marketplace', icon: Search, label: 'Search' },
            { path: '/cart', icon: ShoppingCart, label: 'Cart', badge: cart.item_count },
            { path: '/orders', icon: Package, label: 'Orders' },
            { path: '/profile', icon: User, label: 'Profile' },
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
