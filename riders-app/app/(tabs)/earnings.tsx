import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as API } from '../../constants/api';
import { COLORS, SHADOWS } from '../../constants';

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string; icon: string }[] = [
  { key: 'day',   label: 'Today',      icon: '☀️' },
  { key: 'week',  label: 'This Week',  icon: '📅' },
  { key: 'month', label: 'This Month', icon: '🗓️' },
  { key: 'year',  label: 'This Year',  icon: '📆' },
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

export default function EarningsTab() {
  const insets = useSafeAreaInsets();

  const [period, setPeriod]       = useState<Period>('day');
  const [data, setData]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState<number | null>(null);

  const load = useCallback(async (p: Period, showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res   = await fetch(`${API}/rider/earnings.php?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(period); }, [period]);

  const summary    = data?.summary || {};
  const todayStats = data?.today   || {};
  const allTime    = data?.all_time || {};
  const orders     = data?.orders  || [];
  const daily      = data?.daily_breakdown || [];

  const renderBarChart = (field: 'collections' | 'commission') => {
    if (daily.length === 0) return null;
    const vals = daily.map((d: any) => Number(d[field]) || 0);
    const max  = Math.max(...vals, 1);
    const barW = Math.min(38, (width - 80) / daily.length - 5);

    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, paddingTop: 8, height: 80 }}>
        {daily.map((d: any, i: number) => {
          const v = Number(d[field]) || 0;
          const h = Math.max(4, (v / max) * 70);
          return (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{
                width: barW, height: h, borderRadius: 4,
                backgroundColor: field === 'collections' ? COLORS.primary : COLORS.success,
                opacity: 0.8,
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
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: COLORS.primary,
        paddingTop: insets.top + 14,
        paddingBottom: 20,
        paddingHorizontal: 20,
      }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600', marginBottom: 4 }}>
          Rider Dashboard
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 18 }}>
          Earnings & Reports
        </Text>

        {/* Period selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
        >
          {PERIODS.map(p => {
            const active = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => { setPeriod(p.key); setExpanded(null); }}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: active ? 'transparent' : 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 13 }}>{p.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? COLORS.primary : 'rgba(255,255,255,0.8)' }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
              onRefresh={() => load(period, true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Today quick stats (non-day periods) */}
          {period !== 'day' && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 16, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                Today's Quick Stats
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: '#eff6ff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#dbeafe' }}>
                  <Text style={{ fontSize: 11, color: COLORS.blue, fontWeight: '700' }}>Collections</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.primary, marginTop: 4 }}>{fmt(todayStats.today_collections)}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{todayStats.today_deliveries || 0} deliveries</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#a7f3d0' }}>
                  <Text style={{ fontSize: 11, color: COLORS.success, fontWeight: '700' }}>Commission</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.success, marginTop: 4 }}>{fmt(todayStats.today_commission)}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>Delivery earnings</Text>
                </View>
              </View>
            </View>
          )}

          {/* Period summary hero */}
          <View style={{ backgroundColor: COLORS.primary, borderRadius: 22, padding: 22, ...SHADOWS.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {PERIODS.find(p => p.key === period)?.label} Summary
                </Text>
                {data?.start && data?.end && data.start !== data.end && (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                    {fmtDate(data.start)} – {fmtDate(data.end)}
                  </Text>
                )}
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                  {summary.deliveries_count || 0} deliveries
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 22 }}>💰</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Collected</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4 }}>{fmt(summary.total_collections)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' }}>
                <Text style={{ fontSize: 22 }}>🏍️</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Earned</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#34d399', marginTop: 4 }}>{fmt(summary.total_commission)}</Text>
              </View>
            </View>

            {/* Bar chart */}
            {daily.length > 1 && (
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Daily collections
                </Text>
                {renderBarChart('collections')}
              </View>
            )}
          </View>

          {/* Stat chips */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' }}>Shipping Fees</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 4 }}>{fmt(summary.total_shipping_fees)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' }}>Deliveries</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 4 }}>{summary.deliveries_count || 0}</Text>
            </View>
          </View>

          {/* Daily breakdown */}
          {daily.length > 1 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
                Daily Breakdown
              </Text>
              {daily.map((d: any, i: number) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: COLORS.border,
                }}>
                  <View style={{ width: 56 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text }}>
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{d.deliveries} deliveries</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>{fmt(d.collections)}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.success }}>+{fmt(d.commission)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Per-order commission */}
          {orders.length > 0 && (
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
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
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                        {o.order_number || `Order #${o.id}`}
                      </Text>
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
                    <Text style={{ color: COLORS.textMuted, fontSize: 16, marginLeft: 2 }}>{expanded === i ? '⌃' : '⌄'}</Text>
                  </TouchableOpacity>

                  {expanded === i && (o.items || []).length > 0 && (
                    <View style={{ backgroundColor: COLORS.bg, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 8 }}>
                        PRODUCT BREAKDOWN
                      </Text>
                      {(o.items || []).map((item: any, j: number) => (
                        <View key={j} style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 8,
                          borderTopWidth: j > 0 ? 1 : 0, borderTopColor: COLORS.border,
                        }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.text }} numberOfLines={1}>
                              {item.product_name}
                            </Text>
                            <Text style={{ fontSize: 10, color: COLORS.textMuted }}>x{item.quantity} · {item.store_name}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text }}>{fmt(item.item_subtotal || item.price * item.quantity)}</Text>
                            <Text style={{ fontSize: 10, color: '#f59e0b' }}>Platform: {fmt(item.commission_amount)}</Text>
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
            <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 44, alignItems: 'center', ...SHADOWS.sm }}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>📊</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>No deliveries yet</Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }}>
                Complete deliveries to see your earnings here
              </Text>
            </View>
          )}

          {/* All-time totals */}
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
              All-Time Totals
            </Text>
            <View style={{ flexDirection: 'row', gap: 1 }}>
              {[
                { label: 'Deliveries', value: String(allTime.total_deliveries || 0), color: COLORS.primary },
                { label: 'Collected',  value: fmt(allTime.lifetime_collections),     color: COLORS.primary },
                { label: 'Earned',     value: fmt(allTime.lifetime_commission),       color: COLORS.success },
              ].map((s, i) => (
                <View key={s.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: COLORS.border }}>
                  <Text style={{ fontSize: i === 0 ? 22 : 16, fontWeight: '800', color: s.color }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' }}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
