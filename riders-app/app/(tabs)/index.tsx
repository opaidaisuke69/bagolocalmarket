import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  RefreshControl, Image, AppState, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../../constants/api';
import { COLORS, SHADOWS } from '../../constants';

type Tab = 'pickup' | 'delivering' | 'completed';

const TABS: {
  key: Tab; label: string; icon: string;
  emptyIcon: string; emptyTitle: string; emptyDesc: string;
}[] = [
  { key: 'pickup',     label: 'Pickup',     icon: '📦', emptyIcon: '📦', emptyTitle: 'No orders for pickup',     emptyDesc: 'Orders appear when sellers mark them ready to ship' },
  { key: 'delivering', label: 'Delivering', icon: '🛵', emptyIcon: '🛵', emptyTitle: 'No active deliveries',     emptyDesc: 'Pick up an order to start delivering' },
  { key: 'completed',  label: 'History',    icon: '✅', emptyIcon: '🎉', emptyTitle: 'No deliveries yet',        emptyDesc: 'Complete your first delivery to see it here' },
];

function buildImg(path: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${IMG}${path.startsWith('/') ? '' : '/'}${path}`;
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OrdersTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser]         = useState<any>(null);
  const [orders, setOrders]     = useState<any[]>([]);
  const [tab, setTab]           = useState<Tab>('pickup');
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [counts, setCounts]     = useState({ pickup: 0, delivering: 0, completed: 0 });
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [activeOrderNum, setActiveOrderNum]       = useState<string | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    AsyncStorage.getItem('rider_user').then(u => {
      if (u) {
        const p = JSON.parse(u);
        if (!p.name && p.full_name) p.name = p.full_name;
        setUser(p);
      }
    });
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('rider_token');
      if (!token) return;
      const headers: any = { Authorization: `Bearer ${token}` };

      const url = tab === 'pickup'
        ? `${API}/rider/orders.php`
        : `${API}/rider/orders.php?tab=${tab}`;

      const res  = await fetch(url, { headers });
      const data = await res.json();
      setOrders(data.orders || []);
      // Update active delivery state from any tab response
      if (data.has_active_delivery !== undefined) {
        setHasActiveDelivery(data.has_active_delivery);
        setActiveOrderNum(data.active_order || null);
      }

      const [p, d, c] = await Promise.all([
        fetch(`${API}/rider/orders.php`, { headers }).then(r => r.json()),
        fetch(`${API}/rider/orders.php?tab=delivering`, { headers }).then(r => r.json()),
        fetch(`${API}/rider/orders.php?tab=completed`, { headers }).then(r => r.json()),
      ]);
      setCounts({
        pickup:     (p.orders || []).length,
        delivering: (d.orders || []).length,
        completed:  (c.orders || []).length,
      });
      // Pickup tab response carries the active delivery flag
      setHasActiveDelivery(p.has_active_delivery || false);
      setActiveOrderNum(p.active_order || null);
    } catch {}
    setRefreshing(false);
    setInitialLoad(false);
  }, [tab]);

  useEffect(() => {
    setInitialLoad(true);
    fetchOrders();
    pollRef.current = setInterval(fetchOrders, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchOrders]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') fetchOrders();
      appState.current = next;
    });
    return () => sub.remove();
  }, [fetchOrders]);

  const getStatusInfo = (order: any) => {
    const s        = order.status;
    const assigned = order.rider_id && order.rider_id != 0;
    const pending  = order.my_request_status === 'pending';
    if (s === 'ready_to_ship') {
      if (assigned) return { label: 'ASSIGNED',  bg: COLORS.blueLight,    color: COLORS.blue };
      if (pending)  return { label: 'REQUESTED', bg: COLORS.warningLight, color: '#b45309' };
      return              { label: 'AVAILABLE',  bg: '#ecfdf5',           color: COLORS.success };
    }
    if (s === 'shipped')          return { label: 'PICKED UP', bg: COLORS.warningLight, color: '#b45309' };
    if (s === 'out_for_delivery') return { label: 'EN ROUTE',  bg: '#fff7ed',           color: COLORS.accent };
    if (s === 'delivered')        return { label: 'DELIVERED', bg: COLORS.successLight, color: '#047857' };
    return { label: s?.toUpperCase() || '', bg: COLORS.border, color: COLORS.textSecondary };
  };

  const currentTab = TABS.find(t => t.key === tab)!;

  const renderOrder = ({ item }: { item: any }) => {
    const status    = getStatusInfo(item);
    const firstItem = (item.items || [])[0];
    const img       = buildImg(firstItem?.product_image);
    const timeAgo   = getTimeAgo(item.created_at);
    // Lock pickup orders when rider has an active delivery
    const isPickupTab = tab === 'pickup';
    const locked = isPickupTab && hasActiveDelivery && item.status === 'ready_to_ship';

    return (
      <TouchableOpacity
        onPress={() => {
          if (locked) return; // prevent navigation when busy
          router.push(`/order/${item.id}` as any);
        }}
        activeOpacity={locked ? 1 : 0.7}
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 18,
          marginBottom: 12,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: locked ? COLORS.border : COLORS.border,
          opacity: locked ? 0.45 : 1,
          ...SHADOWS.sm,
        }}
      >
        {/* Status stripe */}
        <View style={{ height: 3, backgroundColor: status.color, opacity: 0.4 }} />

        <View style={{ padding: 16 }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>
                {item.order_number || `#${item.id}`}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted }}>· {timeAgo}</Text>
            </View>
            <View style={{ backgroundColor: status.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: status.color, letterSpacing: 0.6 }}>
                {status.label}
              </Text>
            </View>
          </View>

          {/* Store */}
          {firstItem?.store_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 10 }}>🏪</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>
                {firstItem.store_name}
              </Text>
            </View>
          )}

          {/* Route */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ alignItems: 'center', paddingTop: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent }} />
              <View style={{ width: 1.5, height: 18, backgroundColor: COLORS.borderDark, marginVertical: 2 }} />
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.success }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 1 }}>Pickup</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                {item.recipient_name || 'Customer'}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }} numberOfLines={1}>
                {item.street_address}{item.barangay_name ? `, ${item.barangay_name}` : ''}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {img && (
                <Image source={{ uri: img }} style={{ width: 28, height: 28, borderRadius: 7 }} />
              )}
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                {item.items_count || 1} item{(item.items_count || 1) > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '600' }}>COD COLLECT</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.primary }}>
                ₱{Number(item.total_amount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: COLORS.primary,
        paddingTop: insets.top + 14,
        paddingBottom: 0,
        paddingHorizontal: 20,
      }}>
        {/* Greeting row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' }}>
              Good day 👋
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 2 }}>
              {user?.name || user?.full_name || 'Rider'}
            </Text>
          </View>
          {/* Live badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>Online</Text>
          </View>
        </View>

        {/* Summary pills */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Pickup',     count: counts.pickup,     color: COLORS.blueLight,   text: COLORS.blue },
            { label: 'Delivering', count: counts.delivering, color: '#fff7ed',           text: COLORS.accent },
            { label: 'Done',       count: counts.completed,  color: COLORS.successLight, text: COLORS.success },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>{s.count}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Segmented tabs */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(0,0,0,0.22)',
          borderRadius: 16,
          padding: 4,
          marginBottom: -1,
        }}>
          {TABS.map(t => {
            const active = tab === t.key;
            const count  = counts[t.key];
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 13,
                  backgroundColor: active ? '#fff' : 'transparent',
                  alignItems: 'center',
                  ...(active ? SHADOWS.sm : {}),
                  position: 'relative',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: active ? COLORS.primary : 'rgba(255,255,255,0.55)' }}>
                  {t.icon} {t.label}
                </Text>
                {count > 0 && t.key !== 'completed' && (
                  <View style={{
                    position: 'absolute', top: 3, right: 8,
                    backgroundColor: COLORS.accent, minWidth: 16, height: 16,
                    borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
                    borderWidth: 1.5, borderColor: active ? '#fff' : COLORS.primary,
                  }}>
                    <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────── */}
      {/* Active delivery banner — blocks new pickups */}
      {tab === 'pickup' && hasActiveDelivery && (
        <View style={{
          backgroundColor: '#fef3c7', borderBottomWidth: 1, borderBottomColor: '#fde68a',
          paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Text style={{ fontSize: 20 }}>🛵</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>
              Active Delivery in Progress
            </Text>
            <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2, lineHeight: 16 }}>
              Complete Order #{activeOrderNum} before requesting a new pickup.
            </Text>
          </View>
        </View>
      )}

      {initialLoad ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 }}>
          <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 38 }}>{currentTab.emptyIcon}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 6 }}>
            {currentTab.emptyTitle}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 }}>
            {currentTab.emptyDesc}
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => String(i.id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchOrders(); }}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
