import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as API } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
];

function fmt(n: any) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const { width } = Dimensions.get('window');

export default function EarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<Period>('day');
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<number | null>(null);

  const fetch_ = useCallback(async (p: Period, showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res = await fetch(`${API}/rider/earnings.php?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetch_(period); }, [period]);

  const summary = data?.summary || {};
  const todayStats = data?.today || {};
  const allTime = data?.all_time || {};
  const orders = data?.orders || [];
  const daily = data?.daily_breakdown || [];

  // ── Bar chart renderer ────────────────────────────────────────────────────
  const renderBarChart = (field: 'collections' | 'commission') => {
    if (daily.length === 0) return null;
    const vals = daily.map((d: any) => Number(d[field]) || 0);
    const max = Math.max(...vals, 1);
    const barW = Math.min(40, (width - 80) / daily.length - 6);

    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: 8, height: 80 }}>
        {daily.map((d: any, i: number) => {
          const v = Number(d[field]) || 0;
          const h = Math.max(4, (v / max) * 70);
          return (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{
                width: barW, height: h, borderRadius: 4,
                backgroundColor: field === 'collections' ? COLORS.primary : COLORS.success,
                opacity: 0.85,
              }} />
              <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 3 }}>
                {new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short' }).slice(0, 1)}
              </Text>
            </View>
          );
        })}
      </View>
    );
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
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Earnings & Reports</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>Commission & collection summary</Text>
          </View>
        </View>

        {/* Period tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              onPress={() => { setPeriod(p.key); setExpanded(null); }}
              style={{
                paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
                backgroundColor: period === p.key ? '#fff' : 'rgba(255,255,255,0.15)',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: period === p.key ? COLORS.primary : '#fff' }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetch_(period, true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
        >
          {/* Today's quick stats (always shown) */}
          {period !== 'day' && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 16, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Today's Quick Stats</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: '#eff6ff', borderRadius: 14, padding: 14 }}>
                  <Text style={{ fontSize: 11, color: COLORS.blue, fontWeight: '600' }}>Collections</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.primary, marginTop: 4 }}>{fmt(todayStats.today_collections)}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{todayStats.today_deliveries || 0} deliveries</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14 }}>
                  <Text style={{ fontSize: 11, color: COLORS.success, fontWeight: '600' }}>Commission</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.success, marginTop: 4 }}>{fmt(todayStats.today_commission)}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Delivery earnings</Text>
                </View>
              </View>
            </View>
          )}

          {/* Period Summary */}
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {PERIODS.find(p => p.key === period)?.label} Summary
              </Text>
              {data?.start && data?.end && data.start !== data.end && (
                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                  {fmtDate(data.start)} – {fmtDate(data.end)}
                </Text>
              )}
            </View>

            {/* Stat cards row 1 */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {/* Total Collections */}
              <View style={{ flex: 1, backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#dbeafe' }}>
                <Text style={{ fontSize: 22 }}>💰</Text>
                <Text style={{ fontSize: 12, color: COLORS.blue, fontWeight: '700', marginTop: 8 }}>Total Collections</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.primary, marginTop: 4 }}>{fmt(summary.total_collections)}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>COD amount collected</Text>
              </View>
              {/* Total Commission */}
              <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#a7f3d0' }}>
                <Text style={{ fontSize: 22 }}>🏍️</Text>
                <Text style={{ fontSize: 12, color: COLORS.success, fontWeight: '700', marginTop: 8 }}>My Commission</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.success, marginTop: 4 }}>{fmt(summary.total_commission)}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>Delivery earnings</Text>
              </View>
            </View>
            {/* Stat cards row 2 */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' }}>Deliveries</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 4 }}>{summary.deliveries_count || 0}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' }}>Shipping Fees</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 4 }}>{fmt(summary.total_shipping_fees)}</Text>
              </View>
            </View>

            {/* Bar chart – only for multi-day periods */}
            {daily.length > 1 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 }}>Collections by day</Text>
                {renderBarChart('collections')}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.primary }} />
                  <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Collections</Text>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: COLORS.success, marginLeft: 10 }} />
                  <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Commission</Text>
                </View>
              </View>
            )}
          </View>

          {/* Daily Breakdown table – for week/month/year */}
          {daily.length > 1 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Daily Breakdown</Text>
              {daily.map((d: any, i: number) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: COLORS.border,
                }}>
                  <View style={{ width: 60 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text }}>
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{d.deliveries} deliveries</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>{fmt(d.collections)}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.success }}>{fmt(d.commission)} earned</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Per-order commission breakdown */}
          {orders.length > 0 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
                Commission per Order ({orders.length})
              </Text>
              {orders.map((o: any, i: number) => (
                <View key={i} style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: COLORS.border }}>
                  <TouchableOpacity
                    onPress={() => setExpanded(expanded === i ? null : i)}
                    style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>{o.order_number || `Order #${o.id}`}</Text>
                      <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                        {o.recipient_name} · {o.barangay_name}
                      </Text>
                      <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>{fmtTime(o.delivered_at)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>{fmt(o.total_amount)}</Text>
                      <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.success }}>+{fmt(o.rider_earning)}</Text>
                      </View>
                    </View>
                    <Text style={{ color: COLORS.textMuted, fontSize: 18, marginLeft: 4 }}>{expanded === i ? '⌃' : '⌄'}</Text>
                  </TouchableOpacity>

                  {/* Expanded: per-item commission */}
                  {expanded === i && (o.items || []).length > 0 && (
                    <View style={{ backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 8 }}>PRODUCT COMMISSION BREAKDOWN</Text>
                      {(o.items || []).map((item: any, j: number) => (
                        <View key={j} style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 8,
                          borderTopWidth: j > 0 ? 1 : 0, borderTopColor: COLORS.border,
                        }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.text }} numberOfLines={1}>{item.product_name}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.textMuted }}>x{item.quantity} · {item.store_name}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text }}>{fmt(item.item_subtotal || item.price * item.quantity)}</Text>
                            <Text style={{ fontSize: 10, color: '#f59e0b' }}>
                              Platform: {fmt(item.commission_amount)}
                            </Text>
                          </View>
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: COLORS.borderDark }}>
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Delivery fee collected</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.success }}>{fmt(o.rider_earning)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {orders.length === 0 && !loading && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 40, alignItems: 'center', ...SHADOWS.sm }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>No deliveries yet</Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }}>
                Complete deliveries to see your earnings here
              </Text>
            </View>
          )}

          {/* All-time totals */}
          <View style={{ backgroundColor: COLORS.primary, borderRadius: 18, padding: 20, ...SHADOWS.md }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>All-Time Totals</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{allTime.total_deliveries || 0}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Deliveries</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{fmt(allTime.lifetime_collections)}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Collected</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fbbf24' }}>{fmt(allTime.lifetime_commission)}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Earned</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
