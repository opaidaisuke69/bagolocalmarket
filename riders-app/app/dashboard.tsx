import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Image, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

type Tab = 'pickup' | 'delivering' | 'completed';

const TABS: { key: Tab; label: string; icon: string; emptyIcon: string; emptyTitle: string; emptyDesc: string }[] = [
  { key: 'pickup', label: 'Pickup', icon: '📦', emptyIcon: '📦', emptyTitle: 'No orders for pickup', emptyDesc: 'Orders will appear when sellers mark them ready to ship' },
  { key: 'delivering', label: 'Delivering', icon: '🛵', emptyIcon: '🛵', emptyTitle: 'No active deliveries', emptyDesc: 'Pick up an order to start delivering' },
  { key: 'completed', label: 'History', icon: '✅', emptyIcon: '🎉', emptyTitle: 'No deliveries yet', emptyDesc: 'Complete your first delivery to see it here' },
];

function buildImg(path: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${IMG}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('pickup');
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState({ pickup: 0, delivering: 0, completed: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    AsyncStorage.getItem('rider_user').then(u => {
      if (u) {
        const parsed = JSON.parse(u);
        // Normalize name field (API returns full_name)
        if (!parsed.name && parsed.full_name) parsed.name = parsed.full_name;
        setUser(parsed);
      }
    });
  }, []);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(fetchOrders, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab]);

  // Pause polling when app is in background
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        fetchOrders();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [tab]);

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('rider_token');
      if (!token) return;
      const headers: any = { Authorization: `Bearer ${token}` };

      const url = tab === 'pickup'
        ? `${API}/rider/orders.php`
        : `${API}/rider/orders.php?tab=${tab}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      setOrders(data.orders || []);

      // Fetch counts in parallel
      const [p, d, c] = await Promise.all([
        fetch(`${API}/rider/orders.php`, { headers }).then(r => r.json()),
        fetch(`${API}/rider/orders.php?tab=delivering`, { headers }).then(r => r.json()),
        fetch(`${API}/rider/orders.php?tab=completed`, { headers }).then(r => r.json()),
      ]);
      setCounts({
        pickup: (p.orders || []).length,
        delivering: (d.orders || []).length,
        completed: (c.orders || []).length,
      });
    } catch {}
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('rider_token');
    await AsyncStorage.removeItem('rider_user');
    router.replace('/login');
  };

  const getStatusInfo = (order: any) => {
    const s = order.status;
    const assigned = order.rider_id && order.rider_id != 0;
    const hasPending = order.my_request_status === 'pending';
    if (s === 'ready_to_ship') {
      if (assigned) return { label: 'ASSIGNED', bg: COLORS.blueLight, color: COLORS.blue };
      if (hasPending) return { label: 'REQUESTED', bg: COLORS.warningLight, color: '#b45309' };
      return { label: 'AVAILABLE', bg: '#ecfdf5', color: COLORS.success };
    }
    if (s === 'shipped') return { label: 'PICKED UP', bg: COLORS.warningLight, color: '#b45309' };
    if (s === 'out_for_delivery') return { label: 'EN ROUTE', bg: '#fff7ed', color: COLORS.accent };
    if (s === 'delivered') return { label: 'DELIVERED', bg: COLORS.successLight, color: '#047857' };
    return { label: s?.toUpperCase() || '', bg: COLORS.border, color: COLORS.textSecondary };
  };

  const currentTab = TABS.find(t => t.key === tab)!;

  const renderOrder = ({ item }: { item: any }) => {
    const status = getStatusInfo(item);
    const firstItem = (item.items || [])[0];
    const img = buildImg(firstItem?.product_image);
    const timeAgo = getTimeAgo(item.created_at);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/order/${item.id}` as any)}
        activeOpacity={0.7}
        style={{ backgroundColor: COLORS.card, borderRadius: 18, marginBottom: 12, overflow: 'hidden', ...SHADOWS.sm }}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>{item.order_number || `#${item.id}`}</Text>
            <Text style={{ fontSize: 10, color: COLORS.textMuted }}>· {timeAgo}</Text>
          </View>
          <View style={{ backgroundColor: status.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: status.color, letterSpacing: 0.4 }}>{status.label}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          {/* Seller store */}
          {firstItem?.store_name && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10 }}>🏪</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>{firstItem.store_name}</Text>
            </View>
          )}

          {/* Destination with visual route */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ alignItems: 'center', paddingTop: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent }} />
              <View style={{ width: 1.5, height: 20, backgroundColor: COLORS.borderDark, marginVertical: 3 }} />
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.success }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>Pickup from seller</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>{item.recipient_name || 'Customer'}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.street_address}{item.barangay_name ? `, ${item.barangay_name}` : ''}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {img && <Image source={{ uri: img }} style={{ width: 30, height: 30, borderRadius: 8 }} />}
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{item.items_count || 1} item{(item.items_count || 1) > 1 ? 's' : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: COLORS.textMuted }}>COD</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.primary }}>₱{Number(item.total_amount || 0).toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: insets.top + 16, paddingBottom: 22, paddingHorizontal: 20 }}>
        {/* User row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push('/profile' as any)} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontSize: 20 }}>🛵</Text>
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' }}>Rider</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 2 }}>{user?.name || user?.full_name || 'Rider'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/earnings' as any)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
              <Text style={{ fontSize: 16 }}>📊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/remittance' as any)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
              <Text style={{ fontSize: 16 }}>💸</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile' as any)} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' }}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 4, marginTop: 2 }}>
          {TABS.map(t => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 13,
                  backgroundColor: active ? '#fff' : 'transparent',
                  alignItems: 'center',
                  ...(active ? SHADOWS.sm : {}),
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? COLORS.primary : 'rgba(255,255,255,0.55)' }}>
                  {t.icon} {t.label}
                </Text>
                {count > 0 && t.key !== 'completed' && (
                  <View style={{ position: 'absolute', top: 2, right: 8, backgroundColor: COLORS.accent, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      {orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 48 }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 36 }}>{currentTab.emptyIcon}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center', marginBottom: 6 }}>{currentTab.emptyTitle}</Text>
          <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 }}>{currentTab.emptyDesc}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => String(i.id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
