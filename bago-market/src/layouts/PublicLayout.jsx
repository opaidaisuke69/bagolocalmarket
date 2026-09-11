import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Home, Search, ShoppingCart, Package, User, Menu, X, LogOut, Store, LogIn, Heart, Sparkles, LayoutDashboard, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useAuthModal } from '../context/AuthModalContext';
import LoginModal from '../components/auth/LoginModal';
import RegisterModal from '../components/auth/RegisterModal';
import logoImg from '../assets/images/logo.png';

/* Resolve a server-relative image path to a usable URL.
   Vite proxy handles /uploads in dev; same-origin in prod. */
function resolveImg(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}
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
      {/* Main navbar */}
      <header className="bg-primary-800 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src={logoImg} alt="Bago Shop Express" className="h-9 w-auto" />
              <span className="font-bold text-lg hidden sm:block">Bago Shop Express</span>
            </Link>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <form onSubmit={(e) => { e.preventDefault(); const q = e.target.elements.search.value.trim(); if (q) navigate(`/marketplace?search=${encodeURIComponent(q)}`); }} className="flex shadow-sm">
                <input
                  name="search"
                  type="text"
                  placeholder="Search products in Bago City..."
                  className="flex-1 px-4 py-2.5 rounded-l-xl text-gray-900 text-sm outline-none border-0 focus:ring-2 focus:ring-accent-400 focus:ring-inset placeholder-gray-400 transition-all"
                  aria-label="Search products"
                />
                <button type="submit" className="px-5 bg-accent-400 hover:bg-accent-300 rounded-r-xl transition-colors flex items-center justify-center" aria-label="Submit search">
                  <Search size={18} className="text-primary-900" />
                </button>
              </form>
            </div>

            {/* Right: Cart + Auth + User dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Cart — only buyers and guests */}
              {(!user || user.role === 'buyer') && (
                <Link
                  to={user ? '/cart' : '#'}
                  onClick={(e) => { if (!user) { e.preventDefault(); openLogin(); } }}
                  className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label={`Shopping cart${cart.item_count > 0 ? `, ${cart.item_count} items` : ''}`}
                >
                  <ShoppingCart size={22} />
                  {cart.item_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-400 text-primary-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                      {cart.item_count}
                    </span>
                  )}
                </Link>
              )}

              {/* Sign Up / Login — guests only */}
              {!user && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={openRegister}
                    className="px-3 py-1.5 text-sm font-semibold text-white border border-white/40 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={openLogin}
                    className="px-3 py-1.5 text-sm font-semibold bg-accent-400 text-primary-900 rounded-lg hover:bg-accent-300 transition-colors"
                  >
                    Login
                  </button>
                </div>
              )}

              {/* User dropdown — in the main navbar so it has full vertical space */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-accent-400 flex items-center justify-center shrink-0">
                      {resolveImg(user?.profile_image) ? (
                        <img
                          src={resolveImg(user.profile_image)}
                          alt={user.full_name}
                          className="w-full h-full object-cover"
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-primary-900 font-bold text-sm">
                          {(user.full_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:block text-sm font-medium max-w-[96px] truncate">
                      {user.full_name?.split(' ')[0]}
                    </span>
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">

                        {/* User header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-blue-50 border-b border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary-800 flex items-center justify-center shrink-0">
                              {resolveImg(user?.profile_image) ? (
                                <img
                                  src={resolveImg(user.profile_image)}
                                  alt={user.full_name}
                                  className="w-full h-full object-cover"
                                  onError={e => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="text-white font-bold text-sm">
                                  {(user.full_name || 'U').charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">{user.full_name}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Buyer links */}
                        {user.role === 'buyer' && (
                          <div className="py-1">
                            <Link to="/profile" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <User size={15} className="text-gray-400" /> My Profile
                            </Link>
                            <Link to="/orders" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Package size={15} className="text-gray-400" /> My Orders
                            </Link>
                            <Link to="/wishlist" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Heart size={15} className="text-gray-400" /> Wishlist
                            </Link>
                            <Link to="/recommendations" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Sparkles size={15} className="text-gray-400" /> For You
                            </Link>
                          </div>
                        )}

                        {/* Seller links */}
                        {user.role === 'seller' && (
                          <div className="py-1">
                            <Link to="/seller" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <LayoutDashboard size={15} className="text-gray-400" /> Dashboard
                            </Link>
                            <Link to="/seller/products" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Store size={15} className="text-gray-400" /> My Products
                            </Link>
                            <Link to="/seller/orders" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Package size={15} className="text-gray-400" /> Orders
                            </Link>
                            <Link to="/seller/settings" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Settings size={15} className="text-gray-400" /> Store Settings
                            </Link>
                          </div>
                        )}

                        {/* Admin links */}
                        {user.role === 'admin' && (
                          <div className="py-1">
                            <Link to="/admin" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <LayoutDashboard size={15} className="text-gray-400" /> Admin Panel
                            </Link>
                            <Link to="/admin/sellers" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Store size={15} className="text-gray-400" /> Sellers
                            </Link>
                            <Link to="/admin/orders" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Package size={15} className="text-gray-400" /> Orders
                            </Link>
                            <Link to="/admin/activities" onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Settings size={15} className="text-gray-400" /> Activities
                            </Link>
                          </div>
                        )}

                        <div className="border-t border-gray-100 py-1">
                          <button
                            onClick={() => { handleLogout(); setProfileOpen(false); }}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut size={15} /> Log Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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
                <img src={logoImg} alt="Bago Shop Express" className="h-8 w-auto" />
                <span className="font-bold text-primary-900">Bago Shop Express</span>
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
            © 2026 Bago Shop Express. All rights reserved.
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
          {(!user || user.role === 'buyer') && (
            <Link to={user ? '/cart' : '#'} onClick={(e) => { if (!user) { e.preventDefault(); openLogin(); } }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 relative text-gray-500">
              <ShoppingCart size={20} />
              <span className="text-[10px] font-medium">Cart</span>
              {cart.item_count > 0 && (
                <span className="absolute -top-1 right-0 w-4 h-4 bg-accent-400 text-primary-900 text-[9px] font-bold rounded-full flex items-center justify-center">{cart.item_count}</span>
              )}
            </Link>
          )}
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
