import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Package, MapPin, Clock, Check, Truck, Camera } from 'lucide-react-native';
import { ordersAPI } from '../../services/api';
import { IMAGE_BASE_URL } from '../../constants/api';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { COLORS } from '../../constants';

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready_to_ship', label: 'Ready to Ship' },
  { key: 'shipped', label: 'Picked Up' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const data = await ordersAPI.detail(Number(id));
        setOrder(data.order);
      } catch {}
      finally { setLoading(false); }
    };
    if (id) fetchOrder();
  }, [id]);

  // Polling for real-time updates
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const data = await ordersAPI.detail(Number(id));
        setOrder(data.order);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }} edges={['top']}>
        <ProgressBar visible />
        <View style={{ paddingHorizontal: 16, marginTop: 60, gap: 16 }}>
          <Skeleton width="50%" height={20} />
          <Skeleton width="100%" height={80} borderRadius={16} />
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Package size={48} color={COLORS.gray[300]} />
        <Text style={{ color: COLORS.gray[500], marginTop: 16 }}>Order not found</Text>
      </SafeAreaView>
    );
  }

  const statusKeys = STATUS_STEPS.map(s => s.key);
  const currentIdx = statusKeys.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  // Build timeline from status_history
  const statusHistory: any[] = order.status_history || [];

  // Find timestamp for each step from history
  const getStepTime = (stepKey: string): string | null => {
    const entry = statusHistory.find((h: any) => h.status === stepKey);
    return entry ? entry.created_at : null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, backgroundColor: '#f3f4f6', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} color={COLORS.gray[700]} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.gray[900] }}>Order #{order.order_number || order.id}</Text>
          <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>
            Placed {formatDate(order.created_at)}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* Status Summary Card */}
        {!isCancelled && (
          <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900], marginBottom: 16 }}>Order Timeline</Text>
            
            {STATUS_STEPS.map((step, i) => {
              const isCompleted = currentIdx >= i;
              const isCurrent = currentIdx === i;
              const stepTime = getStepTime(step.key);
              const historyEntry = statusHistory.find((h: any) => h.status === step.key);

              return (
                <View key={step.key} style={{ flexDirection: 'row', gap: 12 }}>
                  {/* Timeline line and dot */}
                  <View style={{ alignItems: 'center', width: 20 }}>
                    <View style={{
                      width: isCurrent ? 14 : 10,
                      height: isCurrent ? 14 : 10,
                      borderRadius: 7,
                      backgroundColor: isCompleted ? COLORS.primary[800] : '#e5e7eb',
                      borderWidth: isCurrent ? 3 : 0,
                      borderColor: isCurrent ? COLORS.primary[200] : 'transparent',
                    }} />
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={{
                        width: 2,
                        flex: 1,
                        minHeight: 28,
                        backgroundColor: isCompleted && currentIdx > i ? COLORS.primary[800] : '#e5e7eb',
                      }} />
                    )}
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1, paddingBottom: i < STATUS_STEPS.length - 1 ? 16 : 0 }}>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: isCurrent ? '700' : '500',
                      color: isCompleted ? COLORS.gray[900] : COLORS.gray[400],
                    }}>
                      {step.label}
                    </Text>
                    {stepTime && (
                      <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>
                        {formatDate(stepTime)}
                      </Text>
                    )}
                    {historyEntry?.notes && (
                      <Text style={{ fontSize: 11, color: COLORS.gray[500], marginTop: 2, fontStyle: 'italic' }}>
                        {historyEntry.notes}
                      </Text>
                    )}
                    {historyEntry?.changed_by_name && (
                      <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 1 }}>
                        by {historyEntry.changed_by_name}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={{ backgroundColor: '#fef2f2', marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#991b1b' }}>Order Cancelled</Text>
            {order.cancel_reason && (
              <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{order.cancel_reason}</Text>
            )}
          </View>
        )}

        {/* Rider Proof Photos */}
        {order.delivery && (order.delivery.pickup_proof || order.delivery.delivery_proof) && (
          <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Camera size={16} color={COLORS.primary[800]} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Delivery Proof</Text>
            </View>

            {order.delivery.pickup_proof && (
              <View style={{ marginBottom: order.delivery.delivery_proof ? 16 : 0 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.gray[500], marginBottom: 8 }}>📦 Pickup Proof</Text>
                <Image
                  source={{ uri: buildImageUrl(order.delivery.pickup_proof) || '' }}
                  style={{ width: '100%', height: 180, borderRadius: 12 }}
                  resizeMode="cover"
                />
                {order.delivery.picked_up_at && (
                  <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 6 }}>
                    {formatDate(order.delivery.picked_up_at)}
                  </Text>
                )}
              </View>
            )}

            {order.delivery.delivery_proof && (
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.gray[500], marginBottom: 8 }}>✅ Delivery Proof</Text>
                <Image
                  source={{ uri: buildImageUrl(order.delivery.delivery_proof) || '' }}
                  style={{ width: '100%', height: 180, borderRadius: 12 }}
                  resizeMode="cover"
                />
                {order.delivery.delivered_at && (
                  <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 6 }}>
                    {formatDate(order.delivery.delivered_at)}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Rider Info */}
        {order.delivery && (order.delivery.rider_name || order.delivery.delivery_person_name) && (
          <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Truck size={16} color={COLORS.primary[800]} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Rider Info</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[800] }}>
              {order.delivery.rider_name || order.delivery.delivery_person_name}
            </Text>
            {(order.delivery.rider_contact || order.delivery.delivery_contact) && (
              <Text style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 4 }}>
                📞 {order.delivery.rider_contact || order.delivery.delivery_contact}
              </Text>
            )}
          </View>
        )}

        {/* Delivery Address */}
        <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <MapPin size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Delivery Address</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[800] }}>{order.recipient_name}</Text>
          {order.delivery_contact && (
            <Text style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 2 }}>{order.delivery_contact}</Text>
          )}
          <Text style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 4 }}>
            {order.street_address}{order.barangay_name ? ', ' + order.barangay_name : ''}, Bago City
          </Text>
        </View>

        {/* Items */}
        <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900], marginBottom: 12 }}>Order Items</Text>
          {(order.items || []).map((item: any, i: number) => {
            const imageUri = buildImageUrl(item.product_image);
            return (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#f9fafb', gap: 10 }}>
                <View style={{ width: 56, height: 56, backgroundColor: '#f8fafc', borderRadius: 8, overflow: 'hidden' }}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={18} color={COLORS.gray[300]} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: COLORS.gray[900], fontWeight: '500' }} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>{item.store_name} · x{item.quantity}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>
                  ₱{Number(item.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Payment Summary */}
        <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900], marginBottom: 12 }}>Payment Summary</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Subtotal</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>₱{Number(order.subtotal || 0).toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Delivery Fee</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>₱{Number(order.delivery_fee || 0).toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Payment Method</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>Cash on Delivery</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.gray[900] }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary[800] }}>
              ₱{Number(order.total_amount || 0).toLocaleString()}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
