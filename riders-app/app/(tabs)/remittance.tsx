import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  TextInput, Image, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../../constants/api';
import { COLORS, SHADOWS } from '../../constants';

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildImg(p: string | null | undefined) {
  if (!p) return null;
  if (p.startsWith('http') || p.startsWith('data:')) return p;
  return `${IMG}${p.startsWith('/') ? '' : '/'}${p}`;
}

function fmt(n: any) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  });
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:  { label: 'Pending',  color: '#b45309',      bg: '#fef3c7', icon: '⏳' },
  verified: { label: 'Verified', color: COLORS.success, bg: '#d1fae5', icon: '✅' },
  rejected: { label: 'Rejected', color: COLORS.danger,  bg: '#fee2e2', icon: '❌' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function RemittanceTab() {
  const insets = useSafeAreaInsets();

  const [data, setData]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);

  // Modal fields — period is derived server-side; rider only fills in payment details
  const [reference, setReference]   = useState('');
  const [payMethod, setPayMethod]   = useState('');
  const [notes, setNotes]           = useState('');
  const [receiptImg, setReceiptImg] = useState<string | null>(null);

  // QR modal
  const [qrModal, setQrModal] = useState(false);
  const [qrItem, setQrItem]   = useState<any>(null);

  const load = useCallback(async (showRef = false) => {
    if (showRef) setRefreshing(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res   = await fetch(`${API}/rider/remittance.php`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Open submit modal ─────────────────────────────────────────────────────
  const openModal = () => {
    setReference('');
    setPayMethod('');
    setNotes('');
    setReceiptImg(null);
    setShowModal(true);
  };

  // ── Receipt image picker ──────────────────────────────────────────────────
  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery access is required to attach a receipt.');
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

  // ── Submit remittance ─────────────────────────────────────────────────────
  // Amount is the server-calculated pending_amount; the rider cannot edit it —
  // this prevents mismatches and ensures only current pending orders are remitted.
  const submitRemittance = async () => {
    const pending = Number(data?.pending_amount || 0);
    if (pending <= 0) {
      Alert.alert('Nothing to Remit', 'No pending collections at this time.');
      return;
    }
    if (!receiptImg) {
      Alert.alert('Required', 'Please attach a receipt photo.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res   = await fetch(`${API}/rider/remittance.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action:           'submit_remittance',
          // Send the server's calculated amount — period & order IDs are resolved server-side
          amount:           pending,
          receipt_image:    receiptImg,
          reference_number: reference || null,
          payment_method:   payMethod || null,
          notes:            notes     || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      Alert.alert('Submitted!', json.message, [{
        text: 'OK', onPress: () => { setShowModal(false); load(); },
      }]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit remittance.');
    }
    setSubmitting(false);
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const remittances = data?.remittances  || [];
  const qrCodes     = data?.qr_codes     || [];
  const pendingDays = data?.pending_days || [];
  const allDays     = data?.all_days     || [];
  const pending     = Number(data?.pending_amount || 0);

  // Summary totals — only from PENDING (unremitted) orders, resets properly after remit
  const totalGross      = pendingDays.reduce((s: number, d: any) => s + Number(d.gross_collected || 0), 0);
  const totalCommission = pendingDays.reduce((s: number, d: any) => s + Number(d.my_commission   || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: COLORS.primary,
        paddingTop: insets.top + 14,
        paddingBottom: 24,
        paddingHorizontal: 20,
      }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600', marginBottom: 4 }}>
          COD Management
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Remittance</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >

          {/* ── Pending balance card ──────────────────────────── */}
          <View style={{ backgroundColor: COLORS.primary, borderRadius: 22, padding: 24, ...SHADOWS.md }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Pending to Remit
            </Text>
            <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', marginTop: 6, letterSpacing: -0.5 }}>
              {fmt(pending)}
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              {pendingDays.length} day{pendingDays.length !== 1 ? 's' : ''} of unremitted collections
            </Text>

            {/* Breakdown row */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 18 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14 }}>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Total Collected
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 4 }}>
                  {fmt(totalGross)}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Pending COD</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' }}>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  My Commission
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#34d399', marginTop: 4 }}>
                  {fmt(totalCommission)}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Pending earnings</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={openModal}
              disabled={pending <= 0}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#fff',
                paddingVertical: 14,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: pending > 0 ? 1 : 0.5,
              }}
            >
              <Text style={{ fontSize: 16 }}>📤</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>
                Submit Remittance
              </Text>
            </TouchableOpacity>

            {pending <= 0 && (
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 8 }}>
                No pending collections at this time
              </Text>
            )}
          </View>

          {/* ── Pending daily breakdown ───────────────────────── */}
          {pendingDays.length > 0 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#fde68a', ...SHADOWS.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>⚠️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>Unremitted Collections</Text>
                  <Text style={{ fontSize: 11, color: '#b45309' }}>These orders need to be remitted</Text>
                </View>
              </View>

              {/* Column headers */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginBottom: 8 }}>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Date</Text>
                <Text style={{ width: 70, fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>Collected</Text>
                <Text style={{ width: 70, fontSize: 10, fontWeight: '700', color: COLORS.success, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>My Cut</Text>
                <Text style={{ width: 72, fontSize: 10, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>To Remit</Text>
              </View>

              {pendingDays.map((day: any, i: number) => (
                <View
                  key={day.delivery_date}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 11,
                    paddingHorizontal: 4,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: COLORS.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>
                      {fmtShort(day.delivery_date)}
                    </Text>
                    <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>
                      {day.deliveries} order{day.deliveries !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={{ width: 70, fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'right' }}>
                    {fmt(day.gross_collected)}
                  </Text>
                  <Text style={{ width: 70, fontSize: 12, fontWeight: '600', color: COLORS.success, textAlign: 'right' }}>
                    -{fmt(day.my_commission)}
                  </Text>
                  <View style={{ width: 72, alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#b45309' }}>
                        {fmt(day.to_remit)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Total row */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                paddingHorizontal: 4, marginTop: 4,
                borderTopWidth: 2, borderTopColor: '#fde68a',
              }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.text }}>Total to Remit</Text>
                <Text style={{ width: 70, fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'right' }}>
                  {fmt(totalGross)}
                </Text>
                <Text style={{ width: 70, fontSize: 13, fontWeight: '700', color: COLORS.success, textAlign: 'right' }}>
                  -{fmt(totalCommission)}
                </Text>
                <View style={{ width: 72, alignItems: 'flex-end' }}>
                  <View style={{ backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{fmt(pending)}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── All delivery days history (collapsible) ───────── */}
          {allDays.length > 0 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, overflow: 'hidden', ...SHADOWS.sm }}>
              <TouchableOpacity
                onPress={() => setShowAllDays(v => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>
                    Daily Collection History
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                    {allDays.length} delivery day{allDays.length !== 1 ? 's' : ''} total
                  </Text>
                </View>
                <Text style={{ fontSize: 18, color: COLORS.textMuted }}>{showAllDays ? '⌃' : '⌄'}</Text>
              </TouchableOpacity>

              {showAllDays && (
                <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
                  {/* Column headers */}
                  <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 }}>
                    <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Date</Text>
                    <Text style={{ width: 66, fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>Collected</Text>
                    <Text style={{ width: 60, fontSize: 10, fontWeight: '700', color: COLORS.success, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>Earned</Text>
                    <Text style={{ width: 64, fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right' }}>Status</Text>
                  </View>

                  {allDays.map((day: any, i: number) => {
                    const isPending  = day.is_pending;
                    const coveredBy  = day.covered_by; // 'pending' | 'verified' | null
                    const statusIcon = isPending ? '⏳' : coveredBy === 'verified' ? '✅' : '🕐';
                    const statusClr  = isPending ? '#b45309' : coveredBy === 'verified' ? COLORS.success : COLORS.blue;

                    return (
                      <View
                        key={day.delivery_date}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: COLORS.border,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>
                            {fmtShort(day.delivery_date)}
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>
                            {day.deliveries} order{day.deliveries !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <Text style={{ width: 66, fontSize: 12, fontWeight: '600', color: COLORS.text, textAlign: 'right' }}>
                          {fmt(day.gross_collected)}
                        </Text>
                        <Text style={{ width: 60, fontSize: 12, fontWeight: '600', color: COLORS.success, textAlign: 'right' }}>
                          +{fmt(day.my_commission)}
                        </Text>
                        <View style={{ width: 64, alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 13, color: statusClr }}>{statusIcon}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── Admin QR codes ────────────────────────────────── */}
          {qrCodes.length > 0 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
                Remit To (Scan QR)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {qrCodes.map((qr: any) => (
                  <TouchableOpacity
                    key={qr.id}
                    onPress={() => { setQrItem(qr); setQrModal(true); }}
                    activeOpacity={0.85}
                    style={{
                      width: 140, backgroundColor: COLORS.bg, borderRadius: 14,
                      padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
                    }}
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
                      <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.blue }}>Tap to enlarge</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Remittance history ────────────────────────────── */}
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
              Submission History ({remittances.length})
            </Text>
            {remittances.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 36 }}>
                <Text style={{ fontSize: 40 }}>🧾</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 10 }}>No remittances yet</Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>Submit your first remittance above</Text>
              </View>
            ) : (
              remittances.map((r: any, i: number) => {
                const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending;
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
                          <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>{fmt(r.amount)}</Text>
                          <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
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
                            Verified {fmtDate(r.verified_at?.slice(0, 10) || '')}
                          </Text>
                        )}
                      </View>
                    </View>
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

      {/* ── Submit Modal ─────────────────────────────────────── */}
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
              Scan the admin QR above, then upload your receipt.
            </Text>

            {/* Summary of what is being remitted — read-only */}
            {pendingDays.length > 0 && (
              <View style={{ backgroundColor: '#fef3c7', borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#fde68a' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  You are remitting for:
                </Text>
                {pendingDays.map((day: any) => (
                  <View key={day.delivery_date} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#92400e' }}>
                      {fmtShort(day.delivery_date)} ({day.deliveries} order{day.deliveries !== 1 ? 's' : ''})
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>{fmt(day.to_remit)}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#fde68a', marginTop: 8, paddingTop: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400e' }}>Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#b45309' }}>{fmt(pending)}</Text>
                </View>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Amount is fixed/read-only — calculated server-side */}
              <Text style={ls}>Amount to Remit</Text>
              <View style={[is, { marginBottom: 4, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 }}>{fmt(pending)}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Auto-calculated</Text>
              </View>

              <Text style={[ls, { marginTop: 14 }]}>Payment Method</Text>
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

              <Text style={[ls, { marginTop: 14 }]}>Reference Number</Text>
              <TextInput
                value={reference}
                onChangeText={setReference}
                placeholder="e.g. 12345678"
                placeholderTextColor={COLORS.textMuted}
                style={is}
              />

              <Text style={[ls, { marginTop: 14 }]}>Notes (optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Additional information..."
                placeholderTextColor={COLORS.textMuted}
                style={[is, { minHeight: 70, textAlignVertical: 'top' }]}
              />

              <Text style={[ls, { marginTop: 14 }]}>Receipt Photo *</Text>
              <TouchableOpacity
                onPress={pickReceipt}
                activeOpacity={0.8}
                style={{
                  borderWidth: 1.5, borderColor: COLORS.borderDark,
                  borderStyle: 'dashed', borderRadius: 16,
                  padding: 18, alignItems: 'center', marginBottom: 8,
                }}
              >
                {receiptImg ? (
                  <Image source={{ uri: receiptImg }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textSecondary }}>
                      Tap to attach receipt
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {receiptImg && (
                <TouchableOpacity onPress={() => setReceiptImg(null)}>
                  <Text style={{ fontSize: 12, color: COLORS.danger, textAlign: 'center', marginBottom: 10 }}>
                    Remove photo
                  </Text>
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
                    : <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>Submit</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── QR Fullscreen ────────────────────────────────────── */}
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

// ── Shared styles ─────────────────────────────────────────────────────────────
const ls: any = {
  fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
};
const is: any = {
  backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.borderDark,
  borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13,
  fontSize: 14, color: COLORS.text, marginBottom: 4,
};
