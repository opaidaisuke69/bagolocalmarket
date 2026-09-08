import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  User, MapPin, Settings, LogOut, ChevronRight, LogIn,
  Wallet, Truck, PackageCheck, Star, ShoppingCart, ClipboardList,
  Plus, Trash2, Edit3, Check,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ordersAPI, addressesAPI } from '../../services/api';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';

const API_BASE = require('../../constants/api').API_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Address {
  id: number;
  recipient_name: string;
  contact_number: string;
  barangay_id: number;
  barangay_name?: string;
  street_address: string;
  landmark?: string;
  delivery_notes?: string;
  is_default: number;
}

interface Barangay { id: number; name: string; shipping_fee: number; }

const EMPTY_FORM = {
  recipient_name: '', contact_number: '', barangay_id: '',
  street_address: '', landmark: '', delivery_notes: '', is_default: false,
};

// ── Small row component ───────────────────────────────────────────────────────
function MenuRow({ icon, label, onPress, danger = false }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? '#fee2e2' : '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: danger ? '#ef4444' : '#111827' }}>{label}</Text>
      <ChevronRight size={16} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { count } = useCart();
  const insets = useSafeAreaInsets();

  // order counts
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  const fetchOrderCounts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await ordersAPI.list({ limit: 200 });
      const counts: Record<string, number> = {};
      (data.orders || []).forEach((o: any) => {
        if (o.status === 'delivered' && o.is_rated) return;
        counts[o.status] = (counts[o.status] || 0) + 1;
      });
      setOrderCounts(counts);
    } catch {}
  }, [user]);

  useEffect(() => { fetchOrderCounts(); }, [fetchOrderCounts]);
  useRealtime(fetchOrderCounts, 2000, !!user);

  // ── Addresses ──────────────────────────────────────────────────────────────
  const [addresses,   setAddresses]   = useState<Address[]>([]);
  const [barangays,   setBarangays]   = useState<Barangay[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [showAddrModal, setShowAddrModal] = useState(false);

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [formSaving, setFormSaving] = useState(false);
  const [formMsg,    setFormMsg]   = useState('');

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddrLoading(true);
    try {
      const res = await addressesAPI.list();
      setAddresses(res.addresses || []);
    } catch {}
    setAddrLoading(false);
  }, [user]);

  const loadBarangays = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/barangays/list.php`);
      const json = await res.json();
      setBarangays(json.barangays || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (user) { loadAddresses(); loadBarangays(); }
  }, [user]);

  // Reload addresses when screen regains focus (after add/edit navigation)
  useFocusEffect(useCallback(() => {
    if (user) loadAddresses();
  }, [user, loadAddresses]));

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      recipient_name: user?.name || '',
      is_default: addresses.length === 0,
    });
    setFormMsg('');
    setShowAddrModal(true);
  }

  function openEdit(a: Address) {
    setEditingId(a.id);
    setForm({
      recipient_name: a.recipient_name,
      contact_number: a.contact_number,
      barangay_id:    String(a.barangay_id),
      street_address: a.street_address,
      landmark:       a.landmark || '',
      delivery_notes: a.delivery_notes || '',
      is_default:     a.is_default == 1,
    });
    setFormMsg('');
    setShowAddrModal(true);
  }

  async function saveAddress() {
    if (!form.recipient_name || !form.contact_number || !form.barangay_id || !form.street_address) {
      setFormMsg('Please fill all required fields.'); return;
    }
    setFormSaving(true); setFormMsg('');
    try {
      if (editingId) {
        await addressesAPI.update({ ...form, id: editingId, barangay_id: Number(form.barangay_id) });
      } else {
        await addressesAPI.create({ ...form, barangay_id: Number(form.barangay_id) });
      }
      await loadAddresses();
      setShowAddrModal(false);
    } catch (e: any) {
      setFormMsg(e.message || 'Failed to save address.');
    }
    setFormSaving(false);
  }

  async function deleteAddr(id: number) {
    Alert.alert('Remove Address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { await addressesAPI.delete(id); await loadAddresses(); } catch {}
        },
      },
    ]);
  }

  async function setDefaultAddr(id: number) {
    try { await addressesAPI.update({ id, is_default: true }); await loadAddresses(); } catch {}
  }

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Guest view ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 50, alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>
            <User size={30} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Welcome to Bago Marketplace</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>Sign in to access your profile, orders & recommendations</Text>
        </View>
        <View style={{ alignItems: 'center', marginTop: -22, paddingHorizontal: 24 }}>
          <TouchableOpacity
            onPress={() => router.push('/auth/login' as any)}
            style={{ backgroundColor: COLORS.accent[400], paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 }}
          >
            <LogIn size={16} color={COLORS.primary[900]} />
            <Text style={{ color: COLORS.primary[900], fontWeight: '700', fontSize: 14 }}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/auth/register' as any)} style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, color: COLORS.primary[800], fontWeight: '500' }}>Don't have an account? <Text style={{ fontWeight: '700' }}>Register</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Authenticated view ────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>

        {/* ── Header ── */}
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 14, paddingBottom: 28, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {/* Avatar */}
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                {(user.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{user.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>{user.email}</Text>
              <View style={{ backgroundColor: COLORS.accent[400], alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.primary[900], textTransform: 'capitalize' }}>{user.role}</Text>
              </View>
            </View>
            {/* Cart */}
            <TouchableOpacity onPress={() => router.push('/cart' as any)} style={{ position: 'relative' }}>
              <ShoppingCart size={22} color="#fff" />
              {count > 0 && (
                <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.accent[400], borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: COLORS.primary[900] }}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Purchases section ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, paddingVertical: 16, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>My Purchases</Text>
            <TouchableOpacity onPress={() => router.push('/purchases?tab=all' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 11, color: COLORS.primary[800], fontWeight: '600' }}>View All</Text>
              <ChevronRight size={12} color={COLORS.primary[800]} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { tab: 'pending',   icon: Wallet,       label: 'To Pay'    },
              { tab: 'confirmed', icon: ClipboardList, label: 'To Ship'   },
              { tab: 'shipped',   icon: Truck,        label: 'To Receive' },
              { tab: 'delivered', icon: Star,         label: 'To Rate'   },
            ].map(({ tab, icon: Icon, label }) => (
              <TouchableOpacity key={tab} onPress={() => router.push(`/purchases?tab=${tab}` as any)} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{ position: 'relative' }}>
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <Icon size={19} color={COLORS.primary[800]} />
                  </View>
                  {(orderCounts[tab] || 0) > 0 && (
                    <View style={{ position: 'absolute', top: -3, right: -7, backgroundColor: '#ef4444', borderRadius: 9, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>{orderCounts[tab]}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 10, color: '#6b7280', textAlign: 'center' }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Delivery Addresses ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} color="#10b981" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Delivery Addresses</Text>
              <Text style={{ fontSize: 11, color: '#9ca3af' }}>({addresses.length}/5)</Text>
            </View>
            {addresses.length < 5 && (
              <TouchableOpacity
                onPress={() => router.push('/address/add' as any)}
                style={{ backgroundColor: COLORS.primary[800], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Plus size={12} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {addrLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary[800]} />
            </View>
          ) : addresses.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <MapPin size={32} color="#d1d5db" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 8 }}>No addresses yet</Text>
              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'center' }}>Add a delivery address to start ordering</Text>
              <TouchableOpacity onPress={() => router.push('/address/add' as any)} style={{ marginTop: 12, backgroundColor: COLORS.primary[800], paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Plus size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            addresses.map((addr, i) => (
              <View key={addr.id} style={{ paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f3f4f6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    <MapPin size={16} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{addr.recipient_name}</Text>
                      {addr.is_default == 1 && (
                        <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.primary[800] }}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{addr.contact_number}</Text>
                    <Text style={{ fontSize: 12, color: '#374151', marginTop: 3, lineHeight: 17 }}>
                      {addr.street_address}{addr.barangay_name ? `, ${addr.barangay_name}` : ''}, Bago City
                    </Text>
                    {addr.landmark ? <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Near: {addr.landmark}</Text> : null}
                    {/* GPS pin status */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                      <MapPin size={9} color={(addr as any).latitude ? '#16a34a' : '#d1d5db'} />
                      <Text style={{ fontSize: 9, color: (addr as any).latitude ? '#16a34a' : '#9ca3af' }}>
                        {(addr as any).latitude ? 'GPS pinned' : 'No GPS — tap edit to pin'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'column', gap: 6 }}>
                    {addr.is_default != 1 && (
                      <TouchableOpacity onPress={() => setDefaultAddr(addr.id)} style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} color="#10b981" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/address/edit', params: { address: JSON.stringify(addr) } } as any)}
                      style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Edit3 size={13} color={COLORS.primary[800]} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteAddr(addr.id)} style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Menu ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8 }}>
          <MenuRow icon={<Settings size={16} color="#6b7280" />} label="Settings" onPress={() => {}} />
        </View>
        <View style={{ backgroundColor: '#fff', marginTop: 8 }}>
          <MenuRow icon={<LogOut size={16} color="#ef4444" />} label="Logout" onPress={handleLogout} danger />
        </View>
      </ScrollView>

      {/* ── Address Form Modal ── */}
      <Modal visible={showAddrModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, maxHeight: '90%' }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 18 }}>
              {editingId ? 'Edit Address' : 'Add New Address'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Row 1 */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Recipient Name *</Text>
                  <TextInput
                    value={form.recipient_name}
                    onChangeText={v => setForm(f => ({ ...f, recipient_name: v }))}
                    style={inputStyle}
                    placeholder="Full name"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Contact No. *</Text>
                  <TextInput
                    value={form.contact_number}
                    onChangeText={v => setForm(f => ({ ...f, contact_number: v }))}
                    style={inputStyle}
                    placeholder="09XX XXX XXXX"
                    keyboardType="phone-pad"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Barangay */}
              <Text style={labelStyle}>Barangay *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {barangays.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => setForm(f => ({ ...f, barangay_id: String(b.id) }))}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: String(form.barangay_id) === String(b.id) ? COLORS.primary[800] : '#f3f4f6',
                      borderWidth: 1,
                      borderColor: String(form.barangay_id) === String(b.id) ? COLORS.primary[800] : '#e5e7eb',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: String(form.barangay_id) === String(b.id) ? '#fff' : '#374151' }}>
                      {b.name}
                    </Text>
                    <Text style={{ fontSize: 9, color: String(form.barangay_id) === String(b.id) ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                      ₱{b.shipping_fee}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Street */}
              <Text style={labelStyle}>Street / House No. *</Text>
              <TextInput
                value={form.street_address}
                onChangeText={v => setForm(f => ({ ...f, street_address: v }))}
                style={[inputStyle, { marginBottom: 12 }]}
                placeholder="House no., street name"
                placeholderTextColor="#9ca3af"
              />

              {/* Landmark & Notes */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Landmark</Text>
                  <TextInput
                    value={form.landmark}
                    onChangeText={v => setForm(f => ({ ...f, landmark: v }))}
                    style={inputStyle}
                    placeholder="Near church..."
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Notes</Text>
                  <TextInput
                    value={form.delivery_notes}
                    onChangeText={v => setForm(f => ({ ...f, delivery_notes: v }))}
                    style={inputStyle}
                    placeholder="Ring bell..."
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Default toggle */}
              <TouchableOpacity
                onPress={() => setForm(f => ({ ...f, is_default: !f.is_default }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                  borderColor: form.is_default ? '#10b981' : '#d1d5db',
                  backgroundColor: form.is_default ? '#10b981' : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {form.is_default && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>Set as default address</Text>
                  <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Used by default for orders</Text>
                </View>
              </TouchableOpacity>

              {formMsg ? (
                <Text style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, fontWeight: '500', backgroundColor: '#fee2e2', padding: 10, borderRadius: 10 }}>{formMsg}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <TouchableOpacity onPress={() => setShowAddrModal(false)} style={{ flex: 1, paddingVertical: 15, borderRadius: 13, alignItems: 'center', backgroundColor: '#f3f4f6' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveAddress} disabled={formSaving} style={{ flex: 1, paddingVertical: 15, borderRadius: 13, alignItems: 'center', backgroundColor: COLORS.primary[800], opacity: formSaving ? 0.6 : 1 }}>
                  {formSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{editingId ? 'Save Changes' : 'Add Address'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const labelStyle: any = {
  fontSize: 10, fontWeight: '700', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5,
};
const inputStyle: any = {
  backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
  borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11,
  fontSize: 13, color: '#111827',
};
