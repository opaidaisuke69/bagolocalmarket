import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Package,
  Store,
  RotateCcw,
} from 'lucide-react-native';
import { ordersAPI, cartAPI } from '../services/api';
import { IMAGE_BASE_URL } from '../constants/api';
import { Skeleton } from '../components/ui/Skeleton';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useRealtime } from '../hooks/useRealtime';
import { COLORS } from '../constants';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'to_pay', label: 'To Pay' },
  { key: 'to_ship', label: 'To Ship' },
  { key: 'to_receive', label: 'To Receive' },
  { key: 'delivered', label: 'To Rate' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'TO PAY',
  confirmed: 'TO PAY',
  preparing: 'TO SHIP',
  ready_to_ship: 'TO SHIP',
  shipped: 'TO RECEIVE',
  out_for_delivery: 'TO RECEIVE',
  delivered: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#f59e0b',
  preparing: '#3b82f6',
  ready_to_ship: '#3b82f6',
  shipped: '#10b981',
  out_for_delivery: '#f97316',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export default function PurchasesScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState(tab || 'all');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratedOrders, setRatedOrders] = useState<Set<number>>(new Set());
  const [buyingAgain, setBuyingAgain] = useState<number | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, any> = { limit: 50 };
      if (activeTab !== 'all') params.status = activeTab;
      const data = await ordersAPI.list(params);
      const fetched: any[] = data.orders || [];
      setOrders(fetched);
      // Sync ratedOrders with the freshly fetched is_rated flags
      // so that if the server now confirms an order is fully rated,
      // we don't keep showing "Rate" based on stale local state
      setRatedOrders(prev => {
        const next = new Set(prev);
        fetched.forEach(o => {
          if (o.is_rated === true || o.is_rated === 1 || o.is_rated === '1') {
            next.add(Number(o.id));
          }
        });
        return next;
      });
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Refetch when screen comes back into focus (e.g., after rating)
  useFocusEffect(
    useCallback(() => {
      fetchOrders(true);
    }, [fetchOrders])
  );

  // Real-time poll every 1.5s
  const silentPollOrders = useCallback(async () => {
    await fetchOrders(true);
  }, [fetchOrders]);
  useRealtime(silentPollOrders, 1500, !loading);

  const handleBuyAgain = async (orderId: number, items: any[]) => {
    setBuyingAgain(orderId);
    try {
      const uniqueItems = items.filter(
        (item: any, idx: number, arr: any[]) =>
          arr.findIndex((i: any) => i.product_id === item.product_id) === idx
      );

      // Add all items to cart sequentially
      for (const item of uniqueItems) {
        await cartAPI.add({ product_id: item.product_id, quantity: item.quantity, variation_id: item.variation_id ?? null });
      }

      // Fetch fresh cart to get the actual cart item IDs
      const cartData = await cartAPI.get();
      const cartItems: any[] = cartData.items || [];

      // Find the cart item IDs that match the products we just added
      const addedProductIds = new Set(uniqueItems.map((i: any) => Number(i.product_id)));
      const matchingIds = cartItems
        .filter((ci: any) => addedProductIds.has(Number(ci.product_id)))
        .map((ci: any) => String(ci.id));

      if (matchingIds.length > 0) {
        router.push(`/checkout?itemIds=${matchingIds.join(',')}` as any);
      } else {
        // Fallback: pass product IDs — checkout also matches on product_id
        const productIds = uniqueItems.map((i: any) => String(i.product_id));
        router.push(`/checkout?itemIds=${productIds.join(',')}` as any);
      }
    } catch {
      router.push('/checkout' as any);
    } finally {
      setBuyingAgain(null);
    }
  };

  const renderOrder = ({ item }: { item: any }) => {
    const statusColor = STATUS_COLORS[item.status] || COLORS.gray[500];
    const statusLabel = STATUS_LABELS[item.status] || item.status?.toUpperCase();
    const orderItems = item.items || [];
    const firstItem = orderItems[0];
    const storeName = firstItem?.store_name || firstItem?.seller_name || 'Store';
    const itemCount = orderItems.length;
    // Explicit boolean — handles PHP true/false/1/0/"1"/"0"
    const isRated = ratedOrders.has(Number(item.id)) ||
      item.is_rated === true || item.is_rated === 1 || item.is_rated === '1';

    return (
      <View style={{ backgroundColor: '#fff', marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
        {/* Store header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Store size={13} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>{storeName}</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
        </View>

        {/* All items for this order */}
        <TouchableOpacity
          onPress={() => router.push(`/orders/${item.id}` as any)}
          activeOpacity={0.8}
        >
          {orderItems.slice(0, 2).map((orderItem: any, idx: number) => {
            const imgUri = buildImageUrl(orderItem.product_image);
            return (
              <View
                key={idx}
                style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}
              >
                <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f8fafc', overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6', flexShrink: 0 }}>
                  {imgUri ? (
                    <Image source={{ uri: imgUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={22} color={COLORS.gray[300]} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, color: COLORS.gray[900], lineHeight: 17 }} numberOfLines={2}>
                    {orderItem.product_name}
                  </Text>
                  {orderItem.variation_label ? (
                    <Text style={{ fontSize: 10, color: COLORS.primary[700], fontWeight: '600', marginTop: 2 }}>
                      {orderItem.variation_label}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 3 }}>
                    x{orderItem.quantity || 1}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary[800], alignSelf: 'center' }}>
                  ₱{Number(orderItem.price * orderItem.quantity || orderItem.item_subtotal || 0).toLocaleString()}
                </Text>
              </View>
            );
          })}
          {itemCount > 2 && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>
                +{itemCount - 2} more item{itemCount - 2 > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Footer with total and actions */}
        <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Order Total:</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.primary[800] }}>
              ₱{Number(item.total_amount || 0).toLocaleString()}
            </Text>
          </View>

          {/* Action buttons based on status */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            {item.status === 'pending' && (
              <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 }}>
                <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '600' }}>Cash on Delivery</Text>
              </View>
            )}
            {item.status === 'delivered' && !isRated && (
              <>
                <TouchableOpacity
                  onPress={() => handleBuyAgain(item.id, item.items)}
                  disabled={buyingAgain === item.id}
                  style={{ borderWidth: 1, borderColor: COLORS.gray[300], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: buyingAgain === item.id ? 0.5 : 1 }}
                >
                  {buyingAgain === item.id
                    ? <ActivityIndicator size="small" color={COLORS.gray[600]} />
                    : <RotateCcw size={12} color={COLORS.gray[600]} />
                  }
                  <Text style={{ color: COLORS.gray[600], fontSize: 12, fontWeight: '500' }}>Buy Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/rate/${item.id}` as any)}
                  style={{ backgroundColor: COLORS.primary[800], paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Rate</Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === 'delivered' && isRated && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleBuyAgain(item.id, item.items)}
                  disabled={buyingAgain === item.id}
                  style={{ borderWidth: 1, borderColor: COLORS.gray[300], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: buyingAgain === item.id ? 0.5 : 1 }}
                >
                  {buyingAgain === item.id
                    ? <ActivityIndicator size="small" color={COLORS.gray[600]} />
                    : <RotateCcw size={12} color={COLORS.gray[600]} />
                  }
                  <Text style={{ color: COLORS.gray[600], fontSize: 12, fontWeight: '500' }}>Buy Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/rate/${item.id}?edit=true` as any)}
                  style={{ backgroundColor: COLORS.primary[50], paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: COLORS.primary[200] }}
                >
                  <Text style={{ color: COLORS.primary[800], fontSize: 12, fontWeight: '600' }}>View Rating</Text>
                </TouchableOpacity>
              </View>
            )}
            {(item.status === 'shipped' || item.status === 'out_for_delivery' || item.status === 'confirmed' || item.status === 'preparing' || item.status === 'ready_to_ship') && (
              <TouchableOpacity
                onPress={() => router.push(`/orders/${item.id}` as any)}
                style={{ borderWidth: 1, borderColor: COLORS.gray[300], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
              >
                <Text style={{ color: COLORS.gray[600], fontSize: 12, fontWeight: '500' }}>Track Order</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ProgressBar visible={loading} />

      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }}>My Purchases</Text>
        </View>

        {/* Tabs — scrollable like Shopee */}
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.primary[800] }}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: 3,
                borderBottomColor: activeTab === t.key ? '#fff' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: activeTab === t.key ? '700' : '400',
                color: activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.5)',
              }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Orders */}
      {loading ? (
        <View style={{ paddingTop: 8, gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ backgroundColor: '#fff', padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width={100} height={12} />
                <Skeleton width={60} height={12} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={72} height={72} borderRadius={8} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="40%" height={12} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Skeleton width={80} height={30} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Package size={56} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontSize: 14, fontWeight: '500', marginTop: 16 }}>No orders yet</Text>
          <Text style={{ color: COLORS.gray[400], fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            {activeTab === 'all' ? "Start shopping to see your orders here" : `No "${TABS.find(t => t.key === activeTab)?.label}" orders`}
          </Text>
          <TouchableOpacity onPress={() => router.push('/marketplace' as any)} style={{ marginTop: 20, backgroundColor: COLORS.primary[800], paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Shop Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={COLORS.primary[800]} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}
