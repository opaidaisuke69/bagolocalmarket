import { useState, useEffect, useRef } from 'react';
import {
  Store, User, Lock, Camera, MapPin, Phone, Mail, Globe,
  Link2, CheckCircle, AlertTriangle, Upload,
  RefreshCw, Save, Eye, EyeOff, Edit2, X, Shield,
} from 'lucide-react';
import { sellerAPI } from '../../api/services';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const IMAGE_BASE = import.meta.env.PROD ? '/server' : '';

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ title, subtitle, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center">
            <Icon size={15} className="text-primary-800" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── Labelled input ──────────────────────────────────────────────────────── */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-800 focus:border-primary-800 transition bg-white";

/* ── Image upload block ──────────────────────────────────────────────────── */
function ImageUpload({ label, currentUrl, onUpload, shape = 'rounded-xl', aspect = 'aspect-video', uploading }) {
  const ref = useRef();
  const readFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result);
    reader.readAsDataURL(f);
  };
  const src = currentUrl
    ? (currentUrl.startsWith('data:') ? currentUrl : `${IMAGE_BASE}${currentUrl}`)
    : null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">{label}</p>
      <div className={`relative group border-2 border-dashed border-gray-200 ${shape} overflow-hidden ${aspect} bg-gray-50 hover:border-primary-400 transition cursor-pointer`}
        onClick={() => ref.current.click()}>
        {src
          ? <img src={src} alt={label} className="w-full h-full object-cover" />
          : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Upload size={22} />
              <span className="text-xs">Click to upload</span>
            </div>
          )
        }
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
          {uploading
            ? <RefreshCw size={20} className="text-white animate-spin" />
            : <Camera size={20} className="text-white" />}
        </div>
      </div>
      <input type="file" accept="image/*" ref={ref} className="hidden" onChange={readFile} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function StoreSettings() {
  const { showToast } = useToast();
  const { user, setUser } = useAuth();

  const [loading,   setLoading]   = useState(true);
  const [barangays, setBarangays] = useState([]);

  /* ── Personal info ──────────────────────────────────────────────────────── */
  const [personal, setPersonal] = useState({ full_name: '', contact_number: '' });
  const [savingPersonal, setSavingPersonal] = useState(false);

  /* ── Store info ─────────────────────────────────────────────────────────── */
  const [store, setStore] = useState({
    store_name: '', store_description: '', barangay_id: '',
    store_phone: '', store_email: '', store_address: '',
    facebook_url: '', instagram_url: '',
  });
  const [savingStore, setSavingStore] = useState(false);

  /* ── Images ─────────────────────────────────────────────────────────────── */
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [storeLogo,    setStoreLogo]    = useState(null);
  const [storeBanner,  setStoreBanner]  = useState(null);
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);
  const [uploadingLogo,   setUploadingLogo]   = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  /* ── Password ────────────────────────────────────────────────────────────── */
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [savingPwd, setSavingPwd] = useState(false);

  /* ── Load settings ──────────────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const res = await sellerAPI.storeSettings();
      const s = res.data.seller;
      setPersonal({ full_name: s.full_name || '', contact_number: s.contact_number || '' });
      setStore({
        store_name:        s.store_name        || '',
        store_description: s.store_description || '',
        barangay_id:       s.barangay_id       || '',
        store_phone:       s.store_phone       || '',
        store_email:       s.store_email       || '',
        store_address:     s.store_address     || '',
        facebook_url:      s.facebook_url      || '',
        instagram_url:     s.instagram_url     || '',
      });
      setProfilePhoto(s.profile_image || null);
      setStoreLogo(s.store_logo       || null);
      setStoreBanner(s.store_banner   || null);
      setBarangays(res.data.barangays || []);
    } catch { showToast('Failed to load settings.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* ── Save personal ──────────────────────────────────────────────────────── */
  const savePersonal = async () => {
    if (!personal.full_name.trim()) { showToast('Full name is required.', 'warning'); return; }
    setSavingPersonal(true);
    try {
      await sellerAPI.saveStoreSettings({ action: 'profile', ...personal });
      showToast('Personal info updated.', 'success');
    } catch (e) { showToast(e.response?.data?.message || 'Failed.', 'error'); }
    finally { setSavingPersonal(false); }
  };

  /* ── Save store info ────────────────────────────────────────────────────── */
  const saveStore = async () => {
    if (!store.store_name.trim()) { showToast('Store name is required.', 'warning'); return; }
    setSavingStore(true);
    try {
      await sellerAPI.saveStoreSettings({ action: 'store', ...store });
      showToast('Store info updated.', 'success');
    } catch (e) { showToast(e.response?.data?.message || 'Failed.', 'error'); }
    finally { setSavingStore(false); }
  };

  /* ── Upload helpers ─────────────────────────────────────────────────────── */
  const uploadImage = async (action, base64, setter, setUploading) => {
    setUploading(true);
    try {
      const res = await sellerAPI.saveStoreSettings({ action, image: base64 });
      setter(res.data.url);
      showToast('Image updated.', 'success');
    } catch (e) { showToast(e.response?.data?.message || 'Upload failed.', 'error'); }
    finally { setUploading(false); }
  };

  /* ── Change password ────────────────────────────────────────────────────── */
  const changePassword = async () => {
    if (!pwd.current_password || !pwd.new_password) {
      showToast('All password fields are required.', 'warning'); return;
    }
    if (pwd.new_password.length < 6) {
      showToast('New password must be at least 6 characters.', 'warning'); return;
    }
    if (pwd.new_password !== pwd.confirm_password) {
      showToast('Passwords do not match.', 'warning'); return;
    }
    setSavingPwd(true);
    try {
      await sellerAPI.saveStoreSettings({ action: 'password', ...pwd });
      showToast('Password changed.', 'success');
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { showToast(e.response?.data?.message || 'Failed.', 'error'); }
    finally { setSavingPwd(false); }
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const pwdField = (key, label, show, toggleKey) => (
    <Field label={label} required>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={pwd[key]}
          onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))}
          placeholder={label}
          className={inputCls + ' pr-10'}
        />
        <button type="button" onClick={() => setShowPwd(p => ({ ...p, [toggleKey]: !p[toggleKey] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  );

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Page heading ────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Store Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your profile, store info, and security</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          1. Store Branding (banner + logo)
      ══════════════════════════════════════════════════════════════════ */}
      <Section title="Store Branding" subtitle="Banner, logo, and store visuals"
        icon={Camera}>
        <div className="space-y-5">
          {/* Banner */}
          <ImageUpload
            label="Store Banner (recommended 1200×400px)"
            currentUrl={storeBanner}
            uploading={uploadingBanner}
            aspect="aspect-[4/1]"
            onUpload={img => uploadImage('store_banner', img, setStoreBanner, setUploadingBanner)}
          />

          {/* Logo */}
          <div className="flex items-start gap-6">
            <div className="w-28 shrink-0">
              <ImageUpload
                label="Store Logo"
                currentUrl={storeLogo}
                uploading={uploadingLogo}
                shape="rounded-2xl"
                aspect="aspect-square"
                onUpload={img => uploadImage('store_logo', img, setStoreLogo, setUploadingLogo)}
              />
            </div>
            <div className="flex-1 text-sm text-gray-500 pt-6 space-y-1.5">
              <p className="font-medium text-gray-700">Logo tips</p>
              <p>• Use a square image (1:1 ratio) — at least 200×200px</p>
              <p>• PNG with transparent background works best</p>
              <p>• Avoid text-heavy logos at small sizes</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          2. Profile Photo + Personal Info
      ══════════════════════════════════════════════════════════════════ */}
      <Section title="Personal Information" subtitle="Your account name and contact details" icon={User}
        action={
          <button onClick={savePersonal} disabled={savingPersonal}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-800 px-4 py-2 rounded-xl hover:bg-primary-900 disabled:opacity-60 transition">
            {savingPersonal ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {savingPersonal ? 'Saving…' : 'Save'}
          </button>
        }>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar */}
          <div className="w-24 shrink-0">
            <ImageUpload
              label="Photo"
              currentUrl={profilePhoto}
              uploading={uploadingPhoto}
              shape="rounded-full"
              aspect="aspect-square"
              onUpload={img => uploadImage('profile_photo', img, setProfilePhoto, setUploadingPhoto)}
            />
          </div>

          {/* Fields */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required>
              <input value={personal.full_name}
                onChange={e => setPersonal(p => ({ ...p, full_name: e.target.value }))}
                className={inputCls} placeholder="Your full name" />
            </Field>
            <Field label="Contact Number">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={personal.contact_number}
                  onChange={e => setPersonal(p => ({ ...p, contact_number: e.target.value }))}
                  className={inputCls + ' pl-8'} placeholder="09XX-XXX-XXXX" />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email (read-only)">
                <input value={user?.email || ''} disabled
                  className={inputCls + ' bg-gray-50 text-gray-400 cursor-not-allowed'} />
              </Field>
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          3. Store Info
      ══════════════════════════════════════════════════════════════════ */}
      <Section title="Store Information" subtitle="Details buyers see on your store page" icon={Store}
        action={
          <button onClick={saveStore} disabled={savingStore}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-800 px-4 py-2 rounded-xl hover:bg-primary-900 disabled:opacity-60 transition">
            {savingStore ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            {savingStore ? 'Saving…' : 'Save'}
          </button>
        }>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Field label="Store Name" required>
            <input value={store.store_name}
              onChange={e => setStore(s => ({ ...s, store_name: e.target.value }))}
              className={inputCls} placeholder="My Store" />
          </Field>

          <Field label="Barangay / Location">
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={store.barangay_id}
                onChange={e => setStore(s => ({ ...s, barangay_id: e.target.value }))}
                className={inputCls + ' pl-8 appearance-none'}>
                <option value="">— Select barangay —</option>
                {barangays.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Store Description">
              <textarea value={store.store_description}
                onChange={e => setStore(s => ({ ...s, store_description: e.target.value }))}
                rows={3} placeholder="Tell buyers about your store…"
                className={inputCls + ' resize-none'} />
            </Field>
          </div>

          <Field label="Store Phone">
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={store.store_phone}
                onChange={e => setStore(s => ({ ...s, store_phone: e.target.value }))}
                className={inputCls + ' pl-8'} placeholder="09XX-XXX-XXXX" />
            </div>
          </Field>

          <Field label="Store Email">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={store.store_email}
                onChange={e => setStore(s => ({ ...s, store_email: e.target.value }))}
                className={inputCls + ' pl-8'} placeholder="store@example.com" />
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Store Address">
              <textarea value={store.store_address}
                onChange={e => setStore(s => ({ ...s, store_address: e.target.value }))}
                rows={2} placeholder="Street / unit / landmark…"
                className={inputCls + ' resize-none'} />
            </Field>
          </div>

          <Field label="Facebook Page URL">
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={store.facebook_url}
                onChange={e => setStore(s => ({ ...s, facebook_url: e.target.value }))}
                className={inputCls + ' pl-8'} placeholder="https://facebook.com/yourpage" />
            </div>
          </Field>

          <Field label="Instagram URL">
            <div className="relative">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={store.instagram_url}
                onChange={e => setStore(s => ({ ...s, instagram_url: e.target.value }))}
                className={inputCls + ' pl-8'} placeholder="https://instagram.com/yourpage" />
            </div>
          </Field>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          4. Security / Password
      ══════════════════════════════════════════════════════════════════ */}
      <Section title="Security" subtitle="Change your login password" icon={Shield}
        action={
          <button onClick={changePassword} disabled={savingPwd}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-800 px-4 py-2 rounded-xl hover:bg-primary-900 disabled:opacity-60 transition">
            {savingPwd ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
            {savingPwd ? 'Saving…' : 'Change Password'}
          </button>
        }>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pwdField('current_password', 'Current Password', showPwd.current, 'current')}
          {pwdField('new_password',     'New Password',     showPwd.new,     'new')}
          {pwdField('confirm_password', 'Confirm Password', showPwd.confirm, 'confirm')}
        </div>
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
          <Shield size={11} /> Minimum 6 characters. Use a mix of letters and numbers for best security.
        </p>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          5. Account Status
      ══════════════════════════════════════════════════════════════════ */}
      <Section title="Account Status" subtitle="Your seller account standing" icon={CheckCircle}>
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Account Status',   value: user?.status || 'active',
              cls: user?.status === 'active' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50' },
            { label: 'Approval Status',  value: user?.profile?.approval_status || 'pending',
              cls: user?.profile?.approval_status === 'approved' ? 'text-green-700 bg-green-50' : 'text-yellow-700 bg-yellow-50' },
          ].map((item, i) => (
            <div key={i} className="flex-1 min-w-[160px] bg-gray-50 rounded-2xl p-4 border">
              <p className="text-xs text-gray-400 font-medium mb-1">{item.label}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold capitalize ${item.cls}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
