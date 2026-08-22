import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Store, Loader2, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { barangaysAPI } from '../../api/services';

export default function Register() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role') || 'buyer';
  const [form, setForm] = useState({
    full_name: '', email: '', contact_number: '', password: '', confirm_password: '',
    barangay_id: '', complete_address: '', role: roleParam,
    store_name: '', store_description: '', terms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState([]);
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    barangaysAPI.list().then(res => setBarangays(res.data.barangays)).catch(() => {});
  }, []);

  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { level: 0, label: '', color: '' };
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
    return levels[score - 1] || { level: 0, label: '', color: '' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.terms) {
      showToast('Please accept the Terms and Conditions.', 'warning');
      return;
    }
    if (form.password !== form.confirm_password) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (form.password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      showToast('Registration successful! Please login.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-accent-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Store size={28} className="text-primary-900" />
          </div>
          <h1 className="text-xl font-bold text-white">Create Your Account</h1>
          <p className="text-white/60 text-sm">Join Bago City Marketplace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          {/* Role toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => setForm({ ...form, role: 'buyer' })}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${form.role === 'buyer' ? 'bg-white shadow text-primary-800' : 'text-gray-500'}`}
            >
              Buyer
            </button>
            <button
              onClick={() => setForm({ ...form, role: 'seller' })}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${form.role === 'seller' ? 'bg-white shadow text-primary-800' : 'text-gray-500'}`}
            >
              Seller
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm" placeholder="Juan Dela Cruz" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
                <input type="tel" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm" placeholder="09xxxxxxxxx" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm" placeholder="your@email.com" />
            </div>

            {form.role === 'seller' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
                  <input type="text" value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm" placeholder="Your Store Name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store Description</label>
                  <textarea value={form.store_description} onChange={(e) => setForm({ ...form, store_description: e.target.value })} rows={2}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm resize-none" placeholder="Tell us about your store..." />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                <select value={form.barangay_id} onChange={(e) => setForm({ ...form, barangay_id: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm">
                  <option value="">Select Barangay</option>
                  {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complete Address *</label>
                <input type="text" value={form.complete_address} onChange={(e) => setForm({ ...form, complete_address: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm" placeholder="Street, Purok, etc." />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none text-sm pr-10" placeholder="••••••••" />
                {form.confirm_password && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.password === form.confirm_password ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-red-500" />}
                  </span>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-800 focus:ring-primary-800" />
              <span className="text-sm text-gray-600">I agree to the <a href="#" className="text-primary-800 hover:underline">Terms and Conditions</a> and <a href="#" className="text-primary-800 hover:underline">Privacy Policy</a></span>
            </label>

            <button type="submit" disabled={loading}
              className="w-full bg-primary-800 hover:bg-primary-900 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Creating account...</> : `Create ${form.role === 'seller' ? 'Seller' : 'Buyer'} Account`}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account? <Link to="/login" className="text-primary-800 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
