import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  User, MapPin, Settings, LogOut, ChevronRight, Edit3,
  Plus, Trash2, Star, Check, X, Package, Heart, ShoppingBag, Camera,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { addressesAPI, barangaysAPI } from '../../api/services';
import axios from '../../api/axios';

/* Resolve a server-relative image path for display.
   The Vite proxy maps /uploads → XAMPP in dev.
   In prod the file lives at the same origin.
   Just return the path as-is — no origin manipulation needed. */
function resolveImg(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Ensure leading slash
  return path.startsWith('/') ? path : `/${path}`;
}

export default function ProfilePage() {
  const { user, logout, fetchUser } = useAuth();

  // ── User edit state ──────────────────────────────────────────────────────
  const [editing, setEditing]     = useState(false);
  const [saving,  setSaving]      = useState(false);
  const [name,    setName]        = useState(user?.full_name || user?.name || '');
  const [contact, setContact]     = useState(user?.contact_number || '');
  const [editMsg, setEditMsg]     = useState('');

  // ── Profile photo upload ──────────────────────────────────────────────────
  const photoInputRef  = useRef(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await axios.post('/users/profile.php', { action: 'update_photo', image: ev.target.result });
        await fetchUser(); // refresh user in AuthContext so avatar updates everywhere
      } catch {}
      setPhotoUploading(false);
    };
    reader.readAsDataURL(file);
  }

  // ── Addresses state ──────────────────────────────────────────────────────
  const [addresses,   setAddresses]   = useState([]);
  const [barangays,   setBarangays]   = useState([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrError,   setAddrError]   = useState('');

  // ── Address form ─────────────────────────────────────────────────────────
  const [showForm,    setShowForm]   = useState(false);
  const [editingAddr, setEditingAddr] = useState(null); // null = new
  const [formData,    setFormData]   = useState({
    recipient_name: user?.full_name || user?.name || '',
    contact_number: user?.contact_number || '',
    barangay_id:    '',
    street_address: '',
    landmark:       '',
    delivery_notes: '',
    is_default:     false,
  });
  const [formMsg,  setFormMsg]  = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // ── Load addresses & barangays ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadAddresses();
    loadBarangays();
  }, [user]);

  async function loadAddresses() {
    setAddrLoading(true);
    setAddrError('');
    try {
      const res = await addressesAPI.list();
      // addressesAPI.list() returns an axios response: res.data.addresses
      setAddresses(res.data?.addresses || []);
    } catch (err) {
      console.error('loadAddresses error:', err);
      setAddrError('Failed to load addresses.');
    }
    setAddrLoading(false);
  }

  async function loadBarangays() {
    try {
      const res = await barangaysAPI.list();
      setBarangays(res.data?.barangays || []);
    } catch {}
  }

  // ── Save profile ─────────────────────────────────────────────────────────
  async function saveProfile() {
    setSaving(true);
    setEditMsg('');
    try {
      await axios.put('/users/profile.php', { full_name: name, contact_number: contact });
      setEditMsg('Profile updated! ✓');
      setEditing(false);
    } catch (err) {
      setEditMsg(err?.response?.data?.message || 'Failed to update profile.');
    }
    setSaving(false);
  }

  // ── Open address form ────────────────────────────────────────────────────
  function openAdd() {
    setEditingAddr(null);
    setFormData({
      recipient_name: user?.full_name || user?.name || '',
      contact_number: user?.contact_number || '',
      barangay_id:    '',
      street_address: '',
      landmark:       '',
      delivery_notes: '',
      is_default:     addresses.length === 0,
    });
    setFormMsg('');
    setShowForm(true);
  }

  function openEdit(addr) {
    setEditingAddr(addr);
    setFormData({
      recipient_name: addr.recipient_name,
      contact_number: addr.contact_number,
      barangay_id:    addr.barangay_id,
      street_address: addr.street_address,
      landmark:       addr.landmark || '',
      delivery_notes: addr.delivery_notes || '',
      is_default:     addr.is_default == 1,
    });
    setFormMsg('');
    setShowForm(true);
  }

  // ── Submit address form ──────────────────────────────────────────────────
  async function submitAddress(e) {
    e.preventDefault();
    if (!formData.recipient_name || !formData.contact_number || !formData.barangay_id || !formData.street_address) {
      setFormMsg('Please fill all required fields.'); return;
    }
    setFormSaving(true); setFormMsg('');
    try {
      if (editingAddr) {
        await addressesAPI.update({ ...formData, id: editingAddr.id });
      } else {
        await addressesAPI.create(formData);
      }
      await loadAddresses();
      setShowForm(false);
    } catch (err) {
      setFormMsg(err?.response?.data?.message || err.message || 'Failed to save address.');
    }
    setFormSaving(false);
  }

  async function deleteAddress(id) {
    if (!confirm('Remove this address?')) return;
    try {
      await addressesAPI.delete(id);
      await loadAddresses();
    } catch {}
  }

  async function setDefault(id) {
    try {
      await addressesAPI.update({ id, is_default: true });
      await loadAddresses();
    } catch {}
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center max-w-sm w-full">
          <User size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Sign in to view your profile</h2>
          <p className="text-gray-500 text-sm mb-6">Access your addresses, orders, and settings.</p>
          <Link to="/" className="inline-block bg-primary-800 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-10">
      {/* ── Hero Header ── */}
      <div className="bg-gradient-to-r from-primary-900 to-primary-700 pt-8 pb-16 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-5">
          {/* Avatar — click to upload photo */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
              {resolveImg(user.profile_image) ? (
                <img
                  src={resolveImg(user.profile_image)}
                  alt={user.full_name}
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {(user.full_name || user.name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {/* Camera overlay */}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-accent-400 hover:bg-accent-300 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-60"
              title="Change photo"
            >
              {photoUploading
                ? <span className="w-3 h-3 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                : <Camera size={13} className="text-primary-900" />
              }
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white truncate">{user.full_name || user.name}</h1>
              <span className="bg-accent-400 text-primary-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                {user.role}
              </span>
            </div>
            <p className="text-white/60 text-sm mt-1 truncate">{user.email}</p>
            {user.contact_number && (
              <p className="text-white/60 text-sm mt-0.5">{user.contact_number}</p>
            )}
          </div>
          <button
            onClick={() => { setEditing(true); setName(user.full_name || user.name || ''); setContact(user.contact_number || ''); setEditMsg(''); }}
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Edit3 size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="max-w-3xl mx-auto -mt-8 px-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 flex divide-x divide-gray-100">
          <Link to="/orders" className="flex-1 text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
            <ShoppingBag size={20} className="text-primary-800 mx-auto mb-1" />
            <div className="text-xs text-gray-500">Orders</div>
          </Link>
          <Link to="/wishlist" className="flex-1 text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
            <Heart size={20} className="text-rose-500 mx-auto mb-1" />
            <div className="text-xs text-gray-500">Wishlist</div>
          </Link>
          <Link to="/recommendations" className="flex-1 text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
            <Star size={20} className="text-amber-400 mx-auto mb-1" />
            <div className="text-xs text-gray-500">For You</div>
          </Link>
          <Link to="/marketplace" className="flex-1 text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
            <Package size={20} className="text-violet-500 mx-auto mb-1" />
            <div className="text-xs text-gray-500">Browse</div>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-5">
        {/* ── Edit Profile inline ── */}
        {editing && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-700 text-gray-800 mb-4 font-bold">Edit Profile</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Number</label>
                <input
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  placeholder="09XX XXX XXXX"
                />
              </div>
            </div>
            {editMsg && (
              <p className={`text-xs mt-3 font-medium ${editMsg.includes('!') ? 'text-green-600' : 'text-red-500'}`}>{editMsg}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveProfile} disabled={saving} className="flex-2 flex-1 py-2.5 rounded-xl bg-primary-800 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── Delivery Addresses ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-green-500" />
              <span className="text-sm font-bold text-gray-800">Delivery Addresses</span>
              <span className="text-xs text-gray-400">({addresses.length}/5)</span>
            </div>
            {addresses.length < 5 && (
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 bg-primary-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={13} />Add
              </button>
            )}
          </div>

          {addrLoading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading addresses...</div>
          ) : addrError ? (
            <div className="p-6 text-center text-sm text-red-500">{addrError}</div>
          ) : addresses.length === 0 ? (
            <div className="p-8 text-center">
              <MapPin size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">No addresses yet</p>
              <p className="text-xs text-gray-400 mt-1">Add an address to enable delivery</p>
              <button
                onClick={openAdd}
                className="mt-4 inline-flex items-center gap-2 bg-primary-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors"
              >
                <Plus size={14} /> Add Address
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {addresses.map(addr => (
                <li key={addr.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin size={14} className="text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{addr.recipient_name}</span>
                        {addr.is_default == 1 && (
                          <span className="text-[10px] font-bold text-primary-700 bg-primary-50 border border-primary-100 px-1.5 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{addr.contact_number}</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {addr.street_address}{addr.barangay_name ? `, ${addr.barangay_name}` : ''}, Bago City
                      </p>
                      {addr.landmark && (
                        <p className="text-xs text-gray-400 mt-0.5">Near: {addr.landmark}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {addr.is_default != 1 && (
                        <button
                          onClick={() => setDefault(addr.id)}
                          title="Set as default"
                          className="w-7 h-7 rounded-lg hover:bg-green-50 flex items-center justify-center transition-colors"
                        >
                          <Check size={13} className="text-green-500" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(addr)}
                        className="w-7 h-7 rounded-lg hover:bg-blue-50 flex items-center justify-center transition-colors"
                      >
                        <Edit3 size={13} className="text-blue-500" />
                      </button>
                      <button
                        onClick={() => deleteAddress(addr.id)}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Settings & Logout ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Settings size={15} className="text-gray-500" />
              </div>
              <span className="text-sm font-medium text-gray-700">Settings</span>
            </div>
            <ChevronRight size={15} className="text-gray-400" />
          </button>
          <button
            onClick={() => { if (confirm('Log out?')) logout(); }}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <LogOut size={15} className="text-red-500" />
              </div>
              <span className="text-sm font-medium text-red-500">Logout</span>
            </div>
            <ChevronRight size={15} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* ── Address Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">
                {editingAddr ? 'Edit Address' : 'Add New Address'}
              </h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={submitAddress} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recipient Name *</label>
                  <input
                    required
                    value={formData.recipient_name}
                    onChange={e => setFormData(p => ({ ...p, recipient_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Number *</label>
                  <input
                    required
                    value={formData.contact_number}
                    onChange={e => setFormData(p => ({ ...p, contact_number: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Barangay *</label>
                <select
                  required
                  value={formData.barangay_id}
                  onChange={e => setFormData(p => ({ ...p, barangay_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">Select barangay</option>
                  {barangays.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} — ₱{b.shipping_fee} delivery
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Street / House No. *</label>
                <input
                  required
                  value={formData.street_address}
                  onChange={e => setFormData(p => ({ ...p, street_address: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="House no., street name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Landmark</label>
                  <input
                    value={formData.landmark}
                    onChange={e => setFormData(p => ({ ...p, landmark: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Near church, school..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Delivery Notes</label>
                  <input
                    value={formData.delivery_notes}
                    onChange={e => setFormData(p => ({ ...p, delivery_notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Ring bell, etc."
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={e => setFormData(p => ({ ...p, is_default: e.target.checked }))}
                  className="w-4 h-4 rounded accent-primary-800"
                />
                <span className="text-sm text-gray-700 font-medium">Set as default address</span>
              </label>

              {formMsg && (
                <p className="text-xs text-red-500 font-medium bg-red-50 px-3 py-2 rounded-lg">{formMsg}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={formSaving} className="flex-1 py-3 rounded-xl bg-primary-800 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
                  {formSaving ? 'Saving...' : editingAddr ? 'Save Changes' : 'Add Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
