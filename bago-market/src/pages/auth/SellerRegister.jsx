import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Store, Loader2, Check, X, Upload, ImagePlus,
  ChevronRight, ChevronLeft, User, MapPin, ShieldCheck, Lock,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { barangaysAPI, authAPI } from '../../api/services';
import logoImg from '../../assets/images/logo.png';
import LocationMapPicker from '../../components/LocationMapPicker';

const VALID_ID_TYPES = [
  { value: 'philid_digital', label: 'PhilSys ID (Digital)' },
  { value: 'philid_physical', label: 'PhilSys ID (Physical)' },
  { value: 'philid_ephilid', label: 'ePhilID' },
  { value: 'philhealth', label: 'PhilHealth ID' },
  { value: 'prc', label: 'PRC ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'others', label: 'Others (Government-issued)' },
];

const STEPS = [
  { id: 1, label: 'Personal Info', icon: User },
  { id: 2, label: 'Store Details', icon: Store },
  { id: 3, label: 'Verification', icon: ShieldCheck },
  { id: 4, label: 'Password', icon: Lock },
];

export default function SellerRegister() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [barangays, setBarangays] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const sampleInputRef = useRef(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    contact_number: '',
    store_name: '',
    store_description: '',
    barangay_id: '',
    complete_address: '',
    latitude: null,
    longitude: null,
    valid_id_type: '',
    password: '',
    confirm_password: '',
    terms: false,
  });

  // File state
  const [validIdFile, setValidIdFile] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState(null);
  const [sampleFiles, setSampleFiles] = useState([]); // max 10, min 5

  useEffect(() => {
    barangaysAPI.list().then(res => setBarangays(res.data.barangays)).catch(() => {});
  }, []);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // ── Password strength ──────────────────────────────────────
  const getStrength = () => {
    const p = form.password;
    if (!p) return { level: 0, label: '', color: '' };
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return [
      { level: 1, label: 'Weak', color: 'bg-red-500' },
      { level: 2, label: 'Fair', color: 'bg-orange-500' },
      { level: 3, label: 'Good', color: 'bg-yellow-500' },
      { level: 4, label: 'Strong', color: 'bg-green-500' },
    ][s - 1] || { level: 0, label: '', color: '' };
  };
  const strength = getStrength();

  // ── File handlers ──────────────────────────────────────────
  const handleValidId = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setValidIdFile(file);
    setValidIdPreview(URL.createObjectURL(file));
  };

  const handleSampleProducts = (e) => {
    const files = Array.from(e.target.files);
    setSampleFiles(prev => {
      const merged = [...prev, ...files].slice(0, 10);
      return merged;
    });
    // reset input so same file can be re-added if removed
    e.target.value = '';
  };

  const removeSample = (idx) => setSampleFiles(f => f.filter((_, i) => i !== idx));

  // ── Step validation ────────────────────────────────────────
  const validateStep = () => {
    if (step === 1) {
      if (!form.full_name.trim()) { showToast('Full name is required.', 'error'); return false; }
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) { showToast('Valid email is required.', 'error'); return false; }
      if (!form.contact_number.trim()) { showToast('Contact number is required.', 'error'); return false; }
    }
    if (step === 2) {
      if (!form.store_name.trim()) { showToast('Store name is required.', 'error'); return false; }
      if (!form.barangay_id) { showToast('Please select your barangay.', 'error'); return false; }
      if (!form.complete_address.trim()) { showToast('Complete address is required.', 'error'); return false; }
      if (!form.latitude || !form.longitude) { showToast('Please pin your exact store location on the map.', 'error'); return false; }
    }
    if (step === 3) {
      if (!form.valid_id_type) { showToast('Please select an ID type.', 'error'); return false; }
      if (!validIdFile) { showToast('Please upload your valid ID.', 'error'); return false; }
      if (sampleFiles.length < 5) { showToast('Please upload at least 5 sample product images.', 'error'); return false; }
    }
    if (step === 4) {
      if (form.password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return false; }
      if (form.password !== form.confirm_password) { showToast('Passwords do not match.', 'error'); return false; }
      if (!form.terms) { showToast('Please accept the Terms and Conditions.', 'error'); return false; }
    }
    return true;
  };

  const nextStep = () => { if (validateStep()) setStep(s => s + 1); };
  const prevStep = () => setStep(s => s - 1);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('role', 'seller');
      fd.append('full_name', form.full_name);
      fd.append('email', form.email);
      fd.append('contact_number', form.contact_number);
      fd.append('store_name', form.store_name);
      fd.append('store_description', form.store_description);
      fd.append('barangay_id', form.barangay_id);
      fd.append('complete_address', form.complete_address);
      if (form.latitude)  fd.append('latitude',  form.latitude);
      if (form.longitude) fd.append('longitude', form.longitude);
      fd.append('valid_id_type', form.valid_id_type);
      fd.append('password', form.password);
      fd.append('confirm_password', form.confirm_password);
      fd.append('valid_id_image', validIdFile);
      sampleFiles.forEach(f => fd.append('sample_products[]', f));

      await authAPI.registerSeller(fd);
      showToast('Registration submitted! Check your email to verify your account.', 'success');
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.message || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex flex-col items-center justify-start py-8 px-4">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-6">
        <img src={logoImg} alt="Bago Market" className="h-10 w-auto" />
        <span className="text-white font-bold text-lg">Bago City Marketplace</span>
      </Link>

      <div className="w-full max-w-2xl">
        {/* Header card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Store size={20} className="text-accent-400" />
            <h1 className="text-white font-bold text-xl">Seller Registration</h1>
          </div>
          <p className="text-white/60 text-sm">Complete all steps to apply as a verified seller</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-0 mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center">
                <div className={`flex flex-col items-center gap-1 px-2`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all
                    ${done ? 'bg-green-500 border-green-500' : active ? 'bg-white border-white' : 'bg-white/10 border-white/30'}`}>
                    {done
                      ? <Check size={16} className="text-white" />
                      : <Icon size={16} className={active ? 'text-primary-800' : 'text-white/50'} />
                    }
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block ${active ? 'text-white' : done ? 'text-green-300' : 'text-white/40'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 sm:w-12 mt-[-14px] transition-all ${done ? 'bg-green-500' : 'bg-white/20'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          <form onSubmit={step === 4 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>

            {/* ── Step 1: Personal Info ── */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Personal Information</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seller Full Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                    placeholder="Juan Dela Cruz" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seller Email Address <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="your@email.com" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none" />
                  <p className="text-xs text-gray-400 mt-1">A verification link will be sent to this email.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number <span className="text-red-500">*</span></label>
                  <input type="tel" value={form.contact_number} onChange={e => set('contact_number', e.target.value)}
                    placeholder="09xxxxxxxxx" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none" />
                </div>
              </div>
            )}

            {/* ── Step 2: Store Details ── */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Store Details</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.store_name} onChange={e => set('store_name', e.target.value)}
                    placeholder="e.g. Juan's Fresh Produce" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store Description</label>
                  <textarea value={form.store_description} onChange={e => set('store_description', e.target.value)}
                    rows={3} placeholder="Tell buyers what your store sells, your story, etc."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barangay <span className="text-red-500">*</span></label>
                    <select value={form.barangay_id} onChange={e => set('barangay_id', e.target.value)} required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                      <option value="">Select barangay</option>
                      {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Complete Address <span className="text-red-500">*</span></label>
                    <input type="text" value={form.complete_address} onChange={e => set('complete_address', e.target.value)}
                      placeholder="Street, Purok, etc." required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none" />
                  </div>
                </div>

                {/* Map picker */}
                <LocationMapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  label="Pin Your Exact Store Location"
                  height="300px"
                  onChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                />
              </div>
            )}

            {/* ── Step 3: Verification Docs ── */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-gray-800 mb-1">Verification Documents</h2>
                <p className="text-sm text-gray-500 mb-4">These documents verify your identity and that you are an actual seller.</p>

                {/* Valid ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seller Valid ID Type <span className="text-red-500">*</span>
                  </label>
                  <select value={form.valid_id_type} onChange={e => set('valid_id_type', e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none mb-3">
                    <option value="">Select ID type...</option>
                    {VALID_ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Valid ID Image <span className="text-red-500">*</span>
                  </label>
                  {validIdPreview ? (
                    <div className="relative inline-block">
                      <img src={validIdPreview} alt="Valid ID" className="w-full max-w-xs h-40 object-cover rounded-xl border border-gray-200" />
                      <button type="button" onClick={() => { setValidIdFile(null); setValidIdPreview(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-600 hover:bg-primary-50 transition-colors">
                      <Upload size={24} className="text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500 font-medium">Click to upload</span>
                      <span className="text-xs text-gray-400">JPG, PNG, WEBP (clear photo)</span>
                      <input type="file" accept="image/*" onChange={handleValidId} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Sample Products */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sample Product Images{' '}
                    <span className="text-red-500">*</span>{' '}
                    <span className={`text-xs font-normal ${sampleFiles.length >= 5 ? 'text-green-600' : 'text-orange-500'}`}>
                      ({sampleFiles.length}/5 minimum)
                    </span>
                  </label>
                  <p className="text-xs text-gray-400 mb-3">Upload at least 5 photos as evidence that you sell these products. Max 10 photos.</p>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                    {sampleFiles.map((f, i) => (
                      <div key={i} className="relative group aspect-square">
                        <img src={URL.createObjectURL(f)} alt={`sample-${i}`}
                          className="w-full h-full object-cover rounded-lg border border-gray-200" />
                        <button type="button" onClick={() => removeSample(i)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {sampleFiles.length < 10 && (
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 hover:bg-primary-50 transition-colors">
                        <ImagePlus size={20} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400 mt-1">Add</span>
                        <input ref={sampleInputRef} type="file" accept="image/*" multiple onChange={handleSampleProducts} className="hidden" />
                      </label>
                    )}
                  </div>

                  {sampleFiles.length < 5 && (
                    <p className="text-xs text-orange-500 flex items-center gap-1">
                      <span>⚠</span> {5 - sampleFiles.length} more photo{5 - sampleFiles.length !== 1 ? 's' : ''} needed
                    </p>
                  )}
                  {sampleFiles.length >= 5 && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Check size={12} /> Minimum requirement met
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4: Password ── */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Set Your Password</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                      placeholder="Min. 8 characters" required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none pr-11" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">{strength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)}
                      placeholder="Re-enter password" required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:border-transparent outline-none pr-11" />
                    {form.confirm_password && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {form.password === form.confirm_password
                          ? <Check size={17} className="text-green-500" />
                          : <X size={17} className="text-red-500" />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Registration Summary</p>
                  <div className="space-y-1 text-sm text-gray-500">
                    <p><span className="font-medium text-gray-700">Name:</span> {form.full_name}</p>
                    <p><span className="font-medium text-gray-700">Email:</span> {form.email}</p>
                    <p><span className="font-medium text-gray-700">Store:</span> {form.store_name}</p>
                    <p><span className="font-medium text-gray-700">ID Type:</span> {VALID_ID_TYPES.find(t => t.value === form.valid_id_type)?.label}</p>
                    <p><span className="font-medium text-gray-700">Sample Products:</span> {sampleFiles.length} photos</p>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.terms} onChange={e => set('terms', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-800" />
                  <span className="text-sm text-gray-600 leading-relaxed">
                    I agree to the <a href="#" className="text-primary-800 hover:underline font-medium">Terms & Conditions</a> and <a href="#" className="text-primary-800 hover:underline font-medium">Privacy Policy</a>
                  </span>
                </label>
              </div>
            )}

            {/* Navigation buttons */}
            <div className={`flex mt-6 gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
              {step > 1 && (
                <button type="button" onClick={prevStep}
                  className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              {step < 4 ? (
                <button type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm font-semibold transition-colors ml-auto">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-primary-800 hover:bg-primary-900 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Application'}
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/" className="text-primary-800 hover:underline font-medium">Sign in</Link>
            {' · '}
            <Link to="/" className="text-primary-800 hover:underline font-medium">Back to marketplace</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
