import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  TextInput, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

type AccountType = 'gcash' | 'maya' | 'bank' | 'others';

const TYPE_CONFIG: Record<AccountType, { label: string; icon: string; color: string; bg: string }> = {
  gcash:  { label: 'GCash',  icon: '📱', color: '#1c7ddc', bg: '#dbeafe' },
  maya:   { label: 'Maya',   icon: '💳', color: '#059669', bg: '#d1fae5' },
  bank:   { label: 'Bank',   icon: '🏦', color: '#7c3aed', bg: '#ede9fe' },
  others: { label: 'Others', icon: '💰', color: '#b45309', bg: '#fef3c7' },
};

function buildImg(p: string | null | undefined) {
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `${IMG}${p.startsWith('/') ? '' : '/'}${p}`;
}

const EMPTY_FORM = {
  account_id: null as number | null,
  type: 'gcash' as AccountType,
  label: '',
  account_name: '',
  account_number: '',
  qr_code_image: null as string | null,
  is_primary: false,
};

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res = await fetch(`${API}/rider/remittance.php?accounts=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setAccounts(json.accounts || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (acc: any) => {
    setForm({
      account_id: acc.id,
      type: acc.type as AccountType,
      label: acc.label,
      account_name: acc.account_name,
      account_number: acc.account_number,
      qr_code_image: acc.qr_code_image ? buildImg(acc.qr_code_image) : null,
      is_primary: acc.is_primary == 1,
    });
    setShowModal(true);
  };

  const pickQR = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Needed', 'Gallery access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8, base64: true, allowsEditing: true, aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0].base64) {
      const mime = result.assets[0].mimeType || 'image/jpeg';
      setForm(f => ({ ...f, qr_code_image: `data:${mime};base64,${result.assets[0].base64}` }));
    }
  };

  const saveAccount = async () => {
    if (!form.label.trim() || !form.account_name.trim() || !form.account_number.trim()) {
      Alert.alert('Required', 'Please fill in all required fields.'); return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res = await fetch(`${API}/rider/remittance.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'save_account', ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setShowModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save account.');
    }
    setSaving(false);
  };

  const deleteAccount = (id: number, label: string) => {
    Alert.alert('Remove Account', `Remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const token = await AsyncStorage.getItem('rider_token');
          await fetch(`${API}/rider/remittance.php?account_id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          load();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: insets.top + 8, paddingBottom: 20, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '300' }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>My E-Wallets & Banks</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>Manage your payment accounts</Text>
          </View>
          <TouchableOpacity
            onPress={openAdd}
            style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }} showsVerticalScrollIndicator={false}>
          {accounts.length === 0 ? (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 44, alignItems: 'center', marginTop: 20, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 48 }}>🏦</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 14 }}>No accounts yet</Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }}>
                Add your GCash, Maya, or bank account so admin can send your earnings
              </Text>
              <TouchableOpacity
                onPress={openAdd}
                style={{ marginTop: 22, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Add Account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            accounts.map((acc: any) => {
              const cfg = TYPE_CONFIG[acc.type as AccountType] || TYPE_CONFIG.others;
              return (
                <View key={acc.id} style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 24 }}>{cfg.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{acc.label}</Text>
                        {acc.is_primary == 1 && (
                          <View style={{ backgroundColor: COLORS.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.success }}>PRIMARY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{acc.account_name}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: cfg.color, marginTop: 2 }}>{acc.account_number}</Text>
                    </View>

                    {/* QR thumbnail */}
                    {acc.qr_code_image && (
                      <Image source={{ uri: buildImg(acc.qr_code_image)! }} style={{ width: 48, height: 48, borderRadius: 10 }} resizeMode="contain" />
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                      onPress={() => openEdit(acc)}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.blueLight, borderWidth: 1, borderColor: '#bfdbfe' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.blue }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteAccount(acc.id, acc.label)}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fecaca' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.danger }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: COLORS.card,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 16, paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            maxHeight: '90%',
          }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 }}>
              {form.account_id ? 'Edit Account' : 'Add Account'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type selector */}
              <Text style={labelStyle}>Account Type *</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                {(Object.keys(TYPE_CONFIG) as AccountType[]).map(t => {
                  const c = TYPE_CONFIG[t];
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setForm(f => ({ ...f, type: t }))}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                        backgroundColor: form.type === t ? c.bg : COLORS.bg,
                        borderWidth: 2,
                        borderColor: form.type === t ? c.color : COLORS.borderDark,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: form.type === t ? c.color : COLORS.textSecondary }}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Label */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Account Label *</Text>
              <TextInput
                value={form.label}
                onChangeText={v => setForm(f => ({ ...f, label: v }))}
                placeholder="e.g. My GCash, BDO Savings"
                placeholderTextColor={COLORS.textMuted}
                style={inputStyle}
              />

              {/* Account name */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Account Name *</Text>
              <TextInput
                value={form.account_name}
                onChangeText={v => setForm(f => ({ ...f, account_name: v }))}
                placeholder="Full name on account"
                placeholderTextColor={COLORS.textMuted}
                style={inputStyle}
              />

              {/* Account number */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Account Number / Mobile *</Text>
              <TextInput
                value={form.account_number}
                onChangeText={v => setForm(f => ({ ...f, account_number: v }))}
                placeholder="e.g. 09XXXXXXXXX"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                style={inputStyle}
              />

              {/* QR Code */}
              <Text style={[labelStyle, { marginTop: 14 }]}>QR Code (optional)</Text>
              <TouchableOpacity onPress={pickQR} activeOpacity={0.8}
                style={{ borderWidth: 1.5, borderColor: COLORS.borderDark, borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 4 }}
              >
                {form.qr_code_image ? (
                  <Image source={{ uri: form.qr_code_image }} style={{ width: 140, height: 140, borderRadius: 12 }} resizeMode="contain" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 28 }}>📷</Text>
                    <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' }}>Upload QR Code</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Optional — helps admin verify your account</Text>
                  </View>
                )}
              </TouchableOpacity>
              {form.qr_code_image && (
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, qr_code_image: null }))}>
                  <Text style={{ fontSize: 12, color: COLORS.danger, textAlign: 'center', marginBottom: 6 }}>Remove QR</Text>
                </TouchableOpacity>
              )}

              {/* Primary toggle */}
              <TouchableOpacity
                onPress={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.bg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                  borderColor: form.is_primary ? COLORS.success : COLORS.borderDark,
                  backgroundColor: form.is_primary ? COLORS.success : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {form.is_primary && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>Set as Primary Account</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Admin will use this account to send your earnings</Text>
                </View>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.bg }}
                >
                  <Text style={{ fontWeight: '600', color: COLORS.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveAccount}
                  disabled={saving}
                  style={{ flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.primary, opacity: saving ? 0.6 : 1 }}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>{form.account_id ? 'Save Changes' : 'Add Account'}</Text>
                  }
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
  fontSize: 12,
  fontWeight: '700',
  color: COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 6,
};

const inputStyle: any = {
  backgroundColor: COLORS.bg,
  borderWidth: 1,
  borderColor: COLORS.borderDark,
  borderRadius: 13,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 14,
  color: COLORS.text,
};
