import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  TextInput, Image, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

function buildImg(p: string | null | undefined) {
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `${IMG}${p.startsWith('/') ? '' : '/'}${p}`;
}

function fmt(n: any) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'Pending',  color: '#b45309', bg: '#fef3c7', icon: '⏳' },
  verified: { label: 'Verified', color: COLORS.success, bg: '#d1fae5', icon: '✅' },
  rejected: { label: 'Rejected', color: COLORS.danger, bg: '#fee2e2', icon: '❌' },
};

export default function RemittanceScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Submit modal state
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount]       = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd]     = useState('');
  const [reference, setReference]     = useState('');
  const [payMethod, setPayMethod]     = useState('');
  const [notes, setNotes]             = useState('');
  const [receiptImg, setReceiptImg]   = useState<string | null>(null);
  const [selectedQR, setSelectedQR]   = useState<any>(null);

  // QR viewer modal
  const [qrModal, setQrModal]         = useState(false);
  const [qrItem, setQrItem]           = useState<any>(null);

  const load = useCallback(async (showRef = false) => {
    if (showRef) setRefreshing(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res = await fetch(`${API}/rider/remittance.php`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  // Prefill today's date range when modal opens
  const openModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setPeriodEnd(today);
    // Default period start = 7 days ago
    const ago = new Date();
    ago.setDate(ago.getDate() - 6);
    setPeriodStart(ago.toISOString().slice(0, 10));
    setAmount(String(data?.pending_amount > 0 ? Number(data.pending_amount).toFixed(2) : ''));
    setReference('');
    setPayMethod('');
    setNotes('');
    setReceiptImg(null);
    setSelectedQR(null);
    setShowModal(true);
  };

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const mime = result.assets[0].mimeType || 'image/jpeg';
      setReceiptImg(`data:${mime};base64,${result.assets[0].base64}`);
    }
  };

  const submitRemittance = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Required', 'Enter a valid amount.'); return;
    }
    if (!periodStart || !periodEnd) {
      Alert.alert('Required', 'Enter the remittance period.'); return;
    }
    if (!receiptImg) {
      Alert.alert('Required', 'Please attach a receipt photo.'); return;
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res = await fetch(`${API}/rider/remittance.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'submit_remittance',
          amount: Number(amount),
          period_start: periodStart,
          period_end: periodEnd,
          receipt_image: receiptImg,
          reference_number: reference || null,
          payment_method: payMethod || null,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      Alert.alert('Submitted!', json.message, [{ text: 'OK', onPress: () => { setShowModal(false); load(); } }]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit remittance.');
    }
    setSubmitting(false);
  };

  const remittances = data?.remittances || [];
  const qrCodes = data?.qr_codes || [];
  const pending = Number(data?.pending_amount || 0);

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
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Remittance</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>Submit & track your remittances</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/wallet' as any)}
            style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 18 }}>🏦</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
        >
          {/* Pending balance card */}
          <View style={{ backgroundColor: COLORS.primary, borderRadius: 20, padding: 22, ...SHADOWS.md }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>Pending for Remittance</Text>
            <Text style={{ fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 6 }}>{fmt(pending)}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Delivery earnings not yet remitted</Text>
            <TouchableOpacity
              onPress={openModal}
              style={{ marginTop: 18, backgroundColor: '#fff', paddingVertical: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16 }}>📤</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>Submit Remittance</Text>
            </TouchableOpacity>
          </View>

          {/* Admin QR Codes */}
          {qrCodes.length > 0 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
                Remit To (Scan QR)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {qrCodes.map((qr: any) => (
                  <TouchableOpacity
                    key={qr.id}
                    onPress={() => { setQrItem(qr); setQrModal(true); }}
                    activeOpacity={0.85}
                    style={{ width: 140, backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}
                  >
                    {qr.qr_code_image ? (
                      <Image source={{ uri: buildImg(qr.qr_code_image)! }} style={{ width: 80, height: 80, borderRadius: 8 }} resizeMode="contain" />
                    ) : (
                      <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: COLORS.borderDark, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 32 }}>📱</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 10, textAlign: 'center' }}>{qr.label}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' }}>{qr.account_name}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>{qr.account_number}</Text>
                    <View style={{ marginTop: 8, backgroundColor: COLORS.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.blue }}>Tap to enlarge</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Remittance history */}
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
              Remittance History ({remittances.length})
            </Text>
            {remittances.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Text style={{ fontSize: 36 }}>🧾</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 10 }}>No remittances yet</Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>Submit your first remittance above</Text>
              </View>
            ) : (
              remittances.map((r: any, i: number) => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                return (
                  <View key={r.id} style={{
                    paddingVertical: 14,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: COLORS.border,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{fmt(r.amount)}</Text>
                          <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                          {fmtDate(r.period_start)} – {fmtDate(r.period_end)}
                        </Text>
                        {r.payment_method && (
                          <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{r.payment_method}</Text>
                        )}
                        {r.reference_number && (
                          <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Ref: {r.reference_number}</Text>
                        )}
                        {r.status === 'rejected' && r.rejection_reason && (
                          <View style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 8, marginTop: 6 }}>
                            <Text style={{ fontSize: 11, color: COLORS.danger }}>Rejected: {r.rejection_reason}</Text>
                          </View>
                        )}
                        {r.status === 'verified' && (
                          <Text style={{ fontSize: 11, color: COLORS.success, marginTop: 3 }}>
                            Verified on {fmtDate(r.verified_at?.slice(0, 10) || '')}
                          </Text>
                        )}
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                          Submitted {fmtDate(r.created_at?.slice(0, 10) || '')}
                        </Text>
                      </View>
                    </View>

                    {/* Receipt thumbnail */}
                    {r.receipt_image && (
                      <View style={{ marginTop: 10, marginLeft: 52 }}>
                        <Image
                          source={{ uri: buildImg(r.receipt_image)! }}
                          style={{ width: 90, height: 60, borderRadius: 10 }}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* Submit Remittance Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: COLORS.card,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 16, paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            maxHeight: '92%',
          }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>Submit Remittance</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>
              Scan admin QR above to remit, then upload your receipt here.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Amount */}
              <Text style={labelStyle}>Amount (₱) *</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                style={inputStyle}
              />

              {/* Period */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Period Start (YYYY-MM-DD) *</Text>
              <TextInput
                value={periodStart}
                onChangeText={setPeriodStart}
                placeholder="2026-09-01"
                placeholderTextColor={COLORS.textMuted}
                style={inputStyle}
              />
              <Text style={[labelStyle, { marginTop: 14 }]}>Period End (YYYY-MM-DD) *</Text>
              <TextInput
                value={periodEnd}
                onChangeText={setPeriodEnd}
                placeholder="2026-09-07"
                placeholderTextColor={COLORS.textMuted}
                style={inputStyle}
              />

              {/* Payment method */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Payment Method</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                {['GCash', 'Maya', 'Bank Transfer', 'Cash'].map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPayMethod(m)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: payMethod === m ? COLORS.primary : COLORS.bg,
                      borderWidth: 1, borderColor: payMethod === m ? COLORS.primary : COLORS.borderDark,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: payMethod === m ? '#fff' : COLORS.textSecondary }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reference */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Reference Number</Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="e.g. 12345678"
                placeholderTextColor={COLORS.textMuted}
                style={inputStyle}
              />

              {/* Notes */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Additional information..."
                placeholderTextColor={COLORS.textMuted}
                style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
              />

              {/* Receipt photo */}
              <Text style={[labelStyle, { marginTop: 14 }]}>Receipt Photo *</Text>
              <TouchableOpacity onPress={pickReceipt} activeOpacity={0.8}
                style={{ borderWidth: 1.5, borderColor: COLORS.borderDark, borderStyle: 'dashed', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 8 }}
              >
                {receiptImg ? (
                  <Image source={{ uri: receiptImg }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary }}>Tap to attach receipt</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Take a screenshot or photo of your GCash/Maya/bank confirmation</Text>
                  </View>
                )}
              </TouchableOpacity>
              {receiptImg && (
                <TouchableOpacity onPress={() => setReceiptImg(null)}>
                  <Text style={{ fontSize: 12, color: COLORS.danger, textAlign: 'center', marginBottom: 10 }}>Remove photo</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.bg }}
                >
                  <Text style={{ fontWeight: '600', color: COLORS.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRemittance}
                  disabled={submitting}
                  style={{ flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.primary, opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Submit Remittance</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR Fullscreen Modal */}
      <Modal visible={qrModal} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onPress={() => setQrModal(false)}
          activeOpacity={1}
        >
          {qrItem && (
            <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>{qrItem.label}</Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>{qrItem.account_name}</Text>
              {qrItem.qr_code_image ? (
                <Image source={{ uri: buildImg(qrItem.qr_code_image)! }} style={{ width: 240, height: 240, borderRadius: 12 }} resizeMode="contain" />
              ) : (
                <View style={{ width: 240, height: 240, borderRadius: 12, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 60 }}>📱</Text>
                </View>
              )}
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.primary, marginTop: 16 }}>{qrItem.account_number}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>Tap anywhere to close</Text>
            </View>
          )}
        </TouchableOpacity>
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
