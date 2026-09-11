import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, X, Loader2, Check, Upload, ImagePlus, Store, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useToast } from '../../context/ToastContext';
import { barangaysAPI, authAPI } from '../../api/services';
import { useNavigate } from 'react-router-dom';
import logoImg from '../../assets/images/logo.png';

const VALID_ID_TYPES = [
  { value: 'philid_digital',   label: 'PhilSys ID (Digital)'  },
  { value: 'philid_physical',  label: 'PhilSys ID (Physical)' },
  { value: 'philid_ephilid',   label: 'ePhilID'               },
  { value: 'philhealth',       label: 'PhilHealth ID'         },
  { value: 'prc',              label: 'PRC ID'                },
  { value: 'drivers_license',  label: "Driver's License"      },
  { value: 'others',           label: 'Others (Gov-issued)'   },
];

export default function RegisterModal() {
  const [form, setForm] = useState({
    full_name: '', email: '', contact_number: '', password: '', confirm_password: '',
    barangay_id: '', complete_address: '', role: 'buyer',
    store_name: '', store_description: '', valid_id_type: '', terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [barangays, setBarangays]       = useState([]);
  // seller file state
  const [validIdFile, setValidIdFile]       = useState(null);
  const [validIdPreview, setValidIdPreview] = useState(null);
  const [sampleFiles, setSampleFiles]       = useState([]);
  const sampleRef = useRef(null);

  const { register }               = useAuth();
  const { showRegister, closeAll, openLogin } = useAuthModal();
  const { showToast }              = useToast();
  const navigate                   = useNavigate();

  useEffect(() => {
    if (showRegister) {
      barangaysAPI.list().then(res => setBarangays(res.data.barangays)).catch(() => {});
    }
  }, [showRegister]);

  // Reset files when switching role
  useEffect(() => {
    setValidIdFile(null);
    setValidIdPreview(null);
    setSampleFiles([]);
  }, [form.role]);

  if (!showRegister) return null;

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const getStrength = () => {
    const p = form.password;
    if (!p) return { level: 0, label: '', color: '' };
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return [
      { level: 1, label: 'Weak',   color: 'bg-red-500'    },
      { level: 2, label: 'Fair',   color: 'bg-orange-500' },
      { level: 3, label: 'Good',   color: 'bg-yellow-500' },
      { level: 4, label: 'Strong', color: 'bg-green-500'  },
    ][s - 1] || { level: 0, label: '', color: '' };
  };

  const handleValidId = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setValidIdFile(file);
    setValidIdPreview(URL.createObjectURL(file));
  };

  const handleSamples = (e) => {
    const files = Array.from(e.target.files);
    setSampleFiles(prev => [...prev, ...files].slice(0, 10));
    e.target.value = '';
  };

  const removeSample = (i) => setSampleFiles(f => f.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.terms) { showToast('Please accept the Terms and Conditions.', 'warning'); return; }
    if (form.password !== form.confirm_password) { showToast('Passwords do not match.', 'error'); return; }
    if (form.password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }

    if (form.role === 'seller') {
      if (!form.valid_id_type) { showToast('Please select an ID type.', 'error'); return; }
      if (!validIdFile)        { showToast('Please upload your valid ID.', 'error'); return; }
      if (sampleFiles.length < 5) { showToast('Please upload at least 5 sample product photos.', 'error'); return; }
    }

    setLoading(true);
    try {
      if (form.role === 'seller') {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (k !== 'terms') fd.append(k, v); });
        fd.append('valid_id_image', validIdFile);
        sampleFiles.forEach(f => fd.append('sample_products[]', f));
        await authAPI.registerSeller(fd);
      } else {
        await register(form);
      }
      showToast('Registration successful! Check your email to verify your account.', 'success');
      closeAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength();
  const isSeller = form.role === 'seller';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAll} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[94vh] overflow-hidden flex flex-col">
        {/* Close */}
        <button onClick={closeAll} className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full z-10 transition-colors">
          <X size={18} className="text-gray-400" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 px-8 pt-6 pb-5 text-center relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-400 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative">
            <img src={logoImg} alt="Bago Shop Express" className="h-10 w-auto mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white">Create Account</h2>
            <p className="text-white/60 text-xs mt-1">Join Bago Shop Express</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-8 py-5">

          {/* Role toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            {['buyer', 'seller'].map(r => (
              <button key={r} type="button" onClick={() => set('role', r)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all capitalize
                  ${form.role === r ? 'bg-white shadow-sm text-primary-800' : 'text-gray-500'}`}>
                {r}
              </button>
            ))}
          </div>

          {/* Seller notice: redirect to full page */}
          {isSeller && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex items-start gap-3">
              <Store size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">Seller registration requires document uploads</p>
                <p className="text-xs text-amber-600 mt-0.5">You'll need your valid ID and at least 5 sample product photos.</p>
                <button type="button"
                  onClick={() => { closeAll(); navigate('/seller/register'); }}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary-800 hover:underline">
                  Open full registration form <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* ── Personal fields (both roles) ── */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input type="text" placeholder="Juan Dela Cruz" value={form.full_name}
                onChange={e => set('full_name', e.target.value)} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address *</label>
              <input type="email" placeholder="your@email.com" value={form.email}
                onChange={e => set('email', e.target.value)} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact Number *</label>
              <input type="tel" placeholder="09xxxxxxxxx" value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
            </div>

            {/* ── Seller-only fields ── */}
            {isSeller && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store Name *</label>
                  <input type="text" placeholder="Your Store Name" value={form.store_name}
                    onChange={e => set('store_name', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Store Description</label>
                  <textarea placeholder="Describe your store..." value={form.store_description}
                    onChange={e => set('store_description', e.target.value)} rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none resize-none transition-all" />
                </div>
              </>
            )}

            {/* Address (both roles) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Barangay *</label>
                <select value={form.barangay_id} onChange={e => set('barangay_id', e.target.value)} required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none transition-all">
                  <option value="">Select...</option>
                  {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
                <input type="text" placeholder="Street, Purok" value={form.complete_address}
                  onChange={e => set('complete_address', e.target.value)} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none transition-all" />
              </div>
            </div>

            {/* ── Seller verification docs ── */}
            {isSeller && (
              <>
                {/* Valid ID type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valid ID Type *</label>
                  <select value={form.valid_id_type} onChange={e => set('valid_id_type', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none transition-all">
                    <option value="">Select ID type...</option>
                    {VALID_ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {/* Valid ID upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Upload Valid ID *</label>
                  {validIdPreview ? (
                    <div className="relative inline-block">
                      <img src={validIdPreview} alt="Valid ID"
                        className="h-28 w-auto rounded-xl border border-gray-200 object-cover" />
                      <button type="button"
                        onClick={() => { setValidIdFile(null); setValidIdPreview(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-600 hover:bg-primary-50 transition-colors">
                      <Upload size={20} className="text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500 font-medium">Click to upload</span>
                      <span className="text-[10px] text-gray-400">JPG, PNG, WEBP</span>
                      <input type="file" accept="image/*" onChange={handleValidId} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Sample products */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Sample Product Photos *{' '}
                    <span className={`font-normal ${sampleFiles.length >= 5 ? 'text-green-600' : 'text-orange-500'}`}>
                      ({sampleFiles.length}/5 min)
                    </span>
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                    {sampleFiles.map((f, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img src={URL.createObjectURL(f)} alt=""
                          className="w-full h-full object-cover rounded-lg border border-gray-200" />
                        <button type="button" onClick={() => removeSample(i)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-px opacity-0 group-hover:opacity-100 transition-opacity shadow">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {sampleFiles.length < 10 && (
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 hover:bg-primary-50 transition-colors">
                        <ImagePlus size={16} className="text-gray-400" />
                        <input ref={sampleRef} type="file" accept="image/*" multiple
                          onChange={handleSamples} className="hidden" />
                      </label>
                    )}
                  </div>
                  {sampleFiles.length < 5
                    ? <p className="text-[10px] text-orange-500">⚠ {5 - sampleFiles.length} more photo{5 - sampleFiles.length !== 1 ? 's' : ''} needed</p>
                    : <p className="text-[10px] text-green-600 flex items-center gap-1"><Check size={10} /> Minimum met</p>
                  }
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters"
                  value={form.password} onChange={e => set('password', e.target.value)} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none pr-10 transition-all" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Re-enter password"
                  value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white outline-none pr-10 transition-all" />
                {form.confirm_password && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.password === form.confirm_password
                      ? <Check size={15} className="text-green-500" />
                      : <X size={15} className="text-red-500" />}
                  </span>
                )}
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input type="checkbox" checked={form.terms} onChange={e => set('terms', e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-800" />
              <span className="text-xs text-gray-500 leading-relaxed">
                I agree to the <span className="text-primary-800 font-medium">Terms & Conditions</span> and{' '}
                <span className="text-primary-800 font-medium">Privacy Policy</span>
              </span>
            </label>

            <button type="submit" disabled={loading}
              className="w-full bg-primary-800 hover:bg-primary-900 text-white py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-800/20 mt-2">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Creating account...</>
                : `Create ${isSeller ? 'Seller' : 'Buyer'} Account`}
            </button>

            <div className="text-center pt-1 pb-2">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <button type="button" onClick={openLogin}
                  className="text-primary-800 hover:text-primary-900 font-semibold hover:underline">
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
