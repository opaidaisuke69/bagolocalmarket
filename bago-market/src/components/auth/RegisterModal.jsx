import { useState, useEffect } from 'react';
import { Eye, EyeOff, X, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useToast } from '../../context/ToastContext';
import { barangaysAPI } from '../../api/services';
import logoImg from '../../assets/images/logo.png';

export default function RegisterModal() {
  const [form, setForm] = useState({
    full_name: '', email: '', contact_number: '', password: '', confirm_password: '',
    barangay_id: '', complete_address: '', role: 'buyer',
    store_name: '', store_description: '', terms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState([]);
  const { register } = useAuth();
  const { showRegister, closeAll, openLogin } = useAuthModal();
  const { showToast } = useToast();

  useEffect(() => {
    if (showRegister) {
      barangaysAPI.list().then(res => setBarangays(res.data.barangays)).catch(() => {});
    }
  }, [showRegister]);

  if (!showRegister) return null;

  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { level: 0, label: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const levels = [
      { level: 1, label: 'Weak', color: 'bg-red-500' },
      { level: 2, label: 'Fair', color: 'bg-orange-500' },
      { level: 3, label: 'Good', color: 'bg-yellow-500' },
      { level: 4, label: 'Strong', color: 'bg-green-500' },
    ];
    return levels[score - 1] || { level: 0, label: '' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.terms) { showToast('Please accept the Terms and Conditions.', 'warning'); return; }
    if (form.password !== form.confirm_password) { showToast('Passwords do not match.', 'error'); return; }
    if (form.password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }

    setLoading(true);
    try {
      await register(form);
      showToast('Registration successful! Please login.', 'success');
      closeAll();
      setTimeout(() => openLogin(), 300);
    } catch (err) {
      showToast(err.response?.data?.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAll} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[460px] max-h-[92vh] overflow-hidden flex flex-col">
        {/* Close button */}
        <button onClick={closeAll} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full z-10 transition-colors">
          <X size={18} className="text-gray-400" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 px-8 pt-6 pb-5 text-center relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-400 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative">
            <img src={logoImg} alt="Bago Market" className="h-10 w-auto mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white">Create Account</h2>
            <p className="text-white/60 text-xs mt-1">Join Bago City Marketplace today</p>
          </div>
        </div>

        {/* Scrollable form area */}
        <div className="overflow-y-auto flex-1 px-8 py-5">
          {/* Role toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            <button type="button" onClick={() => setForm({ ...form, role: 'buyer' })}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${form.role === 'buyer' ? 'bg-white shadow-sm text-primary-800' : 'text-gray-500'}`}>
              Buyer
            </button>
            <button type="button" onClick={() => setForm({ ...form, role: 'seller' })}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${form.role === 'seller' ? 'bg-white shadow-sm text-primary-800' : 'text-gray-500'}`}>
              Seller
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input type="text" placeholder="Juan Dela Cruz" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
              <input type="email" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact Number</label>
              <input type="tel" placeholder="09xxxxxxxxx" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
            </div>

            {form.role === 'seller' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store Name</label>
                  <input type="text" placeholder="Your Store Name" value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store Description</label>
                  <textarea placeholder="Describe your store..." value={form.store_description} onChange={(e) => setForm({ ...form, store_description: e.target.value })} rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none resize-none transition-all" />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Barangay</label>
                <select value={form.barangay_id} onChange={(e) => setForm({ ...form, barangay_id: e.target.value })} required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none transition-all">
                  <option value="">Select...</option>
                  {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input type="text" placeholder="Street, Purok" value={form.complete_address} onChange={(e) => setForm({ ...form, complete_address: e.target.value })} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none pr-10 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                  ))}
                  <span className="text-[10px] text-gray-500 ml-1">{strength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Re-enter password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none pr-10 transition-all" />
                {form.confirm_password && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.password === form.confirm_password ? <Check size={15} className="text-green-500" /> : <X size={15} className="text-red-500" />}
                  </span>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-800" />
              <span className="text-xs text-gray-500 leading-relaxed">I agree to the <span className="text-primary-800 font-medium">Terms & Conditions</span> and <span className="text-primary-800 font-medium">Privacy Policy</span></span>
            </label>

            <button type="submit" disabled={loading}
              className="w-full bg-primary-800 hover:bg-primary-900 text-white py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-800/20 mt-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create Account'}
            </button>

            <div className="text-center pt-1 pb-2">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button type="button" onClick={openLogin} className="text-primary-800 hover:text-primary-900 font-semibold hover:underline">
                  Log In
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
