import { useState } from 'react';
import { Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useToast } from '../../context/ToastContext';
import logoImg from '../../assets/images/logo.png';

export default function LoginModal() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showLogin, closeAll, openRegister } = useAuthModal();
  const { showToast } = useToast();

  if (!showLogin) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      showToast('Please fill in all fields.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form);
      showToast('Login successful!', 'success');
      closeAll();
      setForm({ email: '', password: '' });
      // Use React Router navigation — no full reload
      if (user.role === 'seller') {
        window.__navigateTo = '/seller';
      } else if (user.role === 'admin') {
        window.__navigateTo = '/admin';
      }
      // Dispatch a custom event so the router can handle it
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { role: user.role } }));
    } catch (err) {
      showToast(err.response?.data?.message || 'Login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAll} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden">
        {/* Close button */}
        <button onClick={closeAll} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full z-10 transition-colors">
          <X size={18} className="text-gray-400" />
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 px-8 pt-8 pb-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-400 rounded-full -translate-y-1/2 translate-x-1/2" />
          </div>
          <div className="relative">
            <img src={logoImg} alt="Bago Market" className="h-12 w-auto mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white">Welcome Back!</h2>
            <p className="text-white/60 text-sm mt-1">Log in to your Bago City Marketplace account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-800 focus:border-transparent focus:bg-white outline-none text-sm transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-800 focus:border-transparent focus:bg-white outline-none text-sm pr-11 transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-800 hover:bg-primary-900 text-white py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-800/20"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Logging in...</> : 'Log In'}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">or</span></div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <button type="button" onClick={openRegister} className="text-primary-800 hover:text-primary-900 font-semibold hover:underline">
                Sign Up
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
