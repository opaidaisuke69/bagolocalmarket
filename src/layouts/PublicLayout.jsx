import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, Search, ShoppingCart, Package, User, Menu, X, Bell, LogOut, Store, LogIn, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useAuthModal } from '../context/AuthModalContext';
import LoginModal from '../components/auth/LoginModal';
import RegisterModal from '../components/auth/RegisterModal';
import logoImg from '../assets/images/logo.png';

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const { openLogin, openRegister } = useAuthModal();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top utility bar - like Shopee */}
      <div className="bg-primary-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-8 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-white/70">Seller Centre</span>
              <span className="text-white/70">Download</span>
              <span className="text-white/70">Follow us</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-white/70 hover:text-white flex items-center gap-1">
                <Bell size={12} /> Notifications
              </button>
              {user ? (
                <div className="relative">
                  <button onClick={() => setProfileOpen(!profileOpen)} className="text-white hover:text-accent-400 font-medium flex items-center gap-1">
                    <User size={12} /> {user.full_name?.split(' ')[0]}
                  </button>
                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-6 w-48 bg-white rounded-lg shadow-xl border z-50 py-1">
                        {user.role === 'buyer' && (
                          <>
                            <Link to="/orders" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">My Orders</Link>
                            <Link to="/wishlist" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">My Wishlist</Link>
                          </>
                        )}
                        {user.role === 'seller' && (
                          <Link to="/seller" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Seller Dashboard</Link>
                        )}
                        {user.role === 'admin' && (
                          <Link to="/admin" onClick={() => setProfileOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Admin Panel</Link>
                        )}
                        <hr className="my-1" />
                        <button onClick={() => { handleLogout(); setProfileOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Logout</button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={openRegister} className="text-white hover:text-accent-400 font-semibold">Sign Up</button>
                  <span className="text-white/40">|</span>
                  <button onClick={openLogin} className="text-white hover:text-accent-400 font-semibold">Login</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main navbar */}
      <header className="bg-primary-800 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src={logoImg} alt="Bago Market" className="h-9 w-auto" />
              <span className="font-bold text-lg hidden sm:block">Bago Market</span>
            </Link>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <form onSubmit={(e) => { e.preventDefault(); const q = e.target.elements.search.value; if (q) navigate(`/marketplace?search=${encodeURIComponent(q)}`); }} className="flex">
                <input
                  name="search"
                  type="text"
                  placeholder="Search products in Bago City..."
                  className="flex-1 px-4 py-2 rounded-l-sm text-gray-900 text-sm outline-none border-0 focus:ring-0 placeholder-gray-400"
                />
                <button type="submit" className="px-5 bg-accent-400 hover:bg-accent-300 rounded-r-sm transition-colors flex items-center justify-center">
                  <Search size={18} className="text-primary-900" />
                </button>
              </form>
            </div>

            {/* Cart */}
            <Link to={user ? '/cart' : '#'} onClick={(e) => { if (!user) { e.preventDefault(); openLogin(); } }} className="relative p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ShoppingCart size={24} />
              {cart.item_count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-400 text-primary-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cart.item_count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-10 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src={logoImg} alt="Bago Market" className="h-8 w-auto" />
                <span className="font-bold text-primary-900">Bago City Marketplace</span>
              </div>
              <p className="text-sm text-gray-500">Your local community marketplace for Bago City, Negros Occidental.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">About</h4>
              <ul className="space-y-1 text-sm text-gray-500">
                <li>About Us</li>
                <li>Seller Centre</li>
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Payment</h4>
              <p className="text-sm text-gray-500">Cash on Delivery (COD) only</p>
              <h4 className="font-semibold text-gray-900 mb-2 mt-4 text-sm">Delivery</h4>
              <p className="text-sm text-gray-500">Within Bago City barangays only</p>
            </div>
          </div>
          <div className="border-t mt-6 pt-6 text-center text-xs text-gray-400">
            © 2024 Bago City Marketplace. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-40">
        <div className="flex items-center justify-around py-2">
          <Link to="/" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isActive('/') ? 'text-primary-800' : 'text-gray-500'}`}>
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to="/marketplace" className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isActive('/marketplace') ? 'text-primary-800' : 'text-gray-500'}`}>
            <Search size={20} />
            <span className="text-[10px] font-medium">Search</span>
          </Link>
          <Link to={user ? '/cart' : '#'} onClick={(e) => { if (!user) { e.preventDefault(); openLogin(); } }}
            className="flex flex-col items-center gap-0.5 px-3 py-1 relative text-gray-500">
            <ShoppingCart size={20} />
            <span className="text-[10px] font-medium">Cart</span>
            {cart.item_count > 0 && (
              <span className="absolute -top-1 right-0 w-4 h-4 bg-accent-400 text-primary-900 text-[9px] font-bold rounded-full flex items-center justify-center">{cart.item_count}</span>
            )}
          </Link>
          {user ? (
            <Link to="/orders" className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500">
              <Package size={20} />
              <span className="text-[10px] font-medium">Orders</span>
            </Link>
          ) : (
            <button onClick={openLogin} className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500">
              <LogIn size={20} />
              <span className="text-[10px] font-medium">Login</span>
            </button>
          )}
          <button onClick={user ? () => navigate('/profile') : openLogin} className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500">
            <User size={20} />
            <span className="text-[10px] font-medium">Me</span>
          </button>
        </div>
      </nav>

      {/* Auth Modals */}
      <LoginModal />
      <RegisterModal />
    </div>
  );
}
