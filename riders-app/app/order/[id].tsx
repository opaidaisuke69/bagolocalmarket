import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, Modal, TextInput, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WebView from 'react-native-webview';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../../constants/api';
import { COLORS, SHADOWS, CANCEL_REASONS } from '../../constants';

function buildImg(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${IMG}${path.startsWith('/') ? '' : '/'}${path}`;
}

function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

// Opens the coordinates in Google Maps (falls back to label search when no pin is set)
function openMaps(lat: string | null | undefined, lng: string | null | undefined, label: string) {
  const hasPin = lat && lng && Number(lat) !== 0 && Number(lng) !== 0;
  const encoded = encodeURIComponent(label);
  const url = hasPin
    ? Platform.select({
        ios:     `maps:0,0?q=${encoded}@${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${encoded})`,
      })
    : Platform.select({
        ios:     `maps:0,0?q=${encoded}`,
        android: `geo:0,0?q=${encoded}`,
      });
  const fallback = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  Linking.canOpenURL(url!).then(supported => {
    Linking.openURL(supported ? url! : fallback);
  });
}

// ── Leaflet map rendered inside a WebView ─────────────────────────────────────
// Displays a pinned marker on an OpenStreetMap tile layer.
// Only rendered when valid coordinates are present.
function LeafletMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const escapedLabel = label.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
               .setView([${lat}, ${lng}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var icon = L.icon({
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAABCcAAAQnAEmzTo0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAP+SURBVHgB1ZrPTxNBFMff21aspJKFEAMVTXvTSCIe5WK9oRfBg8YTJdEzP/wDhD+AX2ejlCPGKDe9ES54tCYmHrsJSevBSK0NVGxnnLdYs7Q77ezuIO3n4jq73b7v+zEzzCuCAlnOzUgJRjjCPQ48iRzigGCCTjgUxDszAJgBBtuxHtxU+Rg2u2kbvg/TnPEZ7Qa3xkLENBiwPngOLdlDUgFf9/k0q/L5UzC8HosBWxiKhtNuN10F5Ep8WcR0BtoKXIlFcbZhtH4gX+JrIs9T0IYIu9IXo6Ep55jh/A95vl2NJxAwdZQdzrG/CM+nhPFr0BHw2Vg0tEJXtoD8AY/zKt8Sl3HoDAq/fmMi0YuFoxRiMAmdYzxhdoWZPcnYEciVWBY6SwBhRyGcK1bG4QSM392rwG6hYl8PD3ZBT8QAzZiRMIyEGWJS96ufvfsOzz8Uj409udkDC3f6QCdVYOOGgXgdNLLxsdRgPEFjbuNBELbfIuePgCYoZZa2CtL7i+JescxAI3ESoG2v80p4v5b3bpDxmqNgakt/MnyxifdrkACdUdAmQMV4goxXfVYFLQLI+5Q+qlAUaJrVgRYBfjw6+/Yb6CCwAK/er7FjlWEnW4agBBYw+0buyZePLsDyRL/0/pKGWggkgDxInnTj6W0Txq52w8MbUXsVdv28higEEiDL40tm2BZQg65pzI2gUfAtYKPJolW/56GNnCyVgkbBtwCZ5yhlKHXqGU1EYOxKt6d3qeBLgMz7lCZzSfnOZOV+v+u2mqLgZyYjfAmQeczO9d6w9HNkvLM2nPhdnT0LaOb9ByJ9WkEz0mg80jDudz3xLEDm/ddTA6DKXJMoeN3oeRIg8z4VbrPUqYcK2m1toHd73W57EuDm/VaFK4Nqwa2gvW63lQXIvN+qcGXICtrrHz3KAmTeVylcGZRGwwNdDeNeoqAk4P2XfVfv02YtKPMuJxVkPH2nCiSg5QTslqtUuNcGuyAoshV6yFRKS/to0Wr1FH2JczPmt3BlLNztO+Ykej99pwIZg3G+rfLkC5EuNRGPRe76KVwZzt0rCVFdU4TtnzD/kyc52ifTLaHc/HHAtBrv5HP+EC6LdysfQyJOYHaPm2fPcDrcPe1emFesWNRIGHTGzjlfhQ5D2LxO/9qxOqwY1O3Qd1hz8lhG2EjThS2AoiA0LUCHQG3XWu/4X7VQz4l1QCqRjc6ecUObNVesiu44TkI7wvh6rCeUcg41zFf0QDtGgmyqN55wnXCHzodmRE+WGsoWnDb0IxDRViWb3G43/bEHtV9ZhaUQ8f93MYXhom+9ehg1VhKI0hkSQZFckY8zZEm7JcVFV+dkfm5j0dYmBMZmOQqZZobX+AN3xr1nX6IyBgAAAABJRU5ErkJggg==',
      iconSize:   [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -44],
    });

    L.marker([${lat}, ${lng}], { icon: icon })
     .addTo(map)
     .bindPopup('<b>${escapedLabel}</b>', { maxWidth: 200 })
     .openPopup();
  </script>
</body>
</html>`;

  return (
    <WebView
      source={{ html }}
      style={{ width: '100%', height: 180, borderRadius: 14 }}
      scrollEnabled={false}
      originWhitelist={['*']}
      javaScriptEnabled
    />
  );
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [user, setUser] = useState<any>(null);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [activeOrderNum, setActiveOrderNum]       = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('rider_user').then(u => { if (u) setUser(JSON.parse(u)); });
    fetchOrder();
    const interval = setInterval(fetchOrder, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchOrder = async () => {
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const headers = { Authorization: `Bearer ${token}` } as any;
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API}/rider/orders.php`, { headers }).then(r => r.json()),
        fetch(`${API}/rider/orders.php?tab=delivering`, { headers }).then(r => r.json()),
        fetch(`${API}/rider/orders.php?tab=completed`, { headers }).then(r => r.json()),
      ]);
      // Update active delivery lock from the pickup-tab response
      setHasActiveDelivery(r1.has_active_delivery || false);
      setActiveOrderNum(r1.active_order || null);

      const all = [...(r1.orders || []), ...(r2.orders || []), ...(r3.orders || [])];
      // De-duplicate by id (an order could appear in multiple tabs in edge cases)
      const seen = new Set<string>();
      const unique = all.filter((o: any) => {
        const key = String(o.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const found = unique.find((o: any) => String(o.id) === String(id));
      if (found) setOrder(found);
    } catch {}
  };

  const doAction = async (action: string, extra: any = {}) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res = await fetch(`${API}/rider/orders.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: Number(id), action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (action === 'cancel_delivery') {
        Alert.alert('Success', data.message, [{ text: 'OK', onPress: () => router.replace('/(tabs)' as any) }]);
      } else if (action === 'out_for_delivery') {
        Alert.alert('🛵 On the Way!', 'Order status updated to Out for Delivery.', [{ text: 'OK', onPress: fetchOrder }]);
      } else {
        Alert.alert('Success', data.message, [{ text: 'OK', onPress: fetchOrder }]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  const cancelDelivery = () => {
    const reason = selectedReason === 'Others' ? otherReason.trim() : selectedReason;
    if (!reason) { Alert.alert('Required', 'Please select a reason.'); return; }
    setShowCancelModal(false);
    doAction('cancel_delivery', { cancel_reason: reason });
    setSelectedReason(null);
    setOtherReason('');
  };

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📦</Text>
        <Text style={{ fontSize: 14, color: COLORS.textMuted }}>Loading order...</Text>
      </View>
    );
  }

  const isReady = order.status === 'ready_to_ship';
  const isShipped = order.status === 'shipped';
  const isInTransit = order.status === 'out_for_delivery';
  const isDelivered = order.status === 'delivered';
  const isAssigned = order.rider_id && order.rider_id != 0;
  const hasPendingRequest = order.my_request_status === 'pending';
  const isApproved = order.my_request_status === 'approved' || isAssigned;

  const statusConfig = isDelivered
    ? { icon: '✅', title: 'Delivered', subtitle: 'This order has been completed', bg: COLORS.successLight, color: COLORS.success }
    : isInTransit
    ? { icon: '🛵', title: 'Out for Delivery', subtitle: 'Head to customer and deliver the order', bg: '#fff7ed', color: COLORS.accent }
    : isShipped
    ? { icon: '📤', title: 'Picked Up', subtitle: 'Tap "Start Delivery" when heading to customer', bg: COLORS.warningLight, color: '#b45309' }
    : isApproved
    ? { icon: '🔒', title: 'Assigned to You', subtitle: 'Head to seller and confirm pickup with photo', bg: COLORS.blueLight, color: COLORS.blue }
    : hasPendingRequest
    ? { icon: '⏳', title: 'Request Pending', subtitle: 'Waiting for seller to approve your pickup request', bg: COLORS.warningLight, color: COLORS.warning }
    : { icon: '📦', title: 'Available for Pickup', subtitle: 'Request this order — seller will approve a rider', bg: '#ecfdf5', color: COLORS.success };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: insets.top + 8, paddingBottom: 18, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '300' }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{order.order_number || `Order #${order.id}`}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
              {formatTime(order.created_at)}
            </Text>
          </View>
          <View style={{ backgroundColor: statusConfig.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: statusConfig.color }}>{statusConfig.title.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 160, gap: 12 }} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: statusConfig.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>{statusConfig.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{statusConfig.title}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3, lineHeight: 17 }}>{statusConfig.subtitle}</Text>
            </View>
          </View>
        </View>

        {/* Seller info + location — shown for all ready_to_ship states (available, pending request, approved) */}
        {isReady && (
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
              {isApproved ? 'Pickup From Seller' : 'Seller Location'}
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
              {(order.items || [])[0]?.store_name || 'Store'}
            </Text>

            {/* Barangay */}
            {(order.items || [])[0]?.seller_barangay && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Text style={{ fontSize: 14 }}>📍</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                  {(order.items || [])[0]?.seller_barangay}, Bago City
                </Text>
              </View>
            )}

            {/* Full address */}
            {(order.items || [])[0]?.store_address && (
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3, marginLeft: 20, lineHeight: 18 }}>
                {(order.items || [])[0]?.store_address}
              </Text>
            )}

            {/* Contact — only once approved */}
            {isApproved && (order.items || [])[0]?.seller_contact && (
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 6 }}>
                {(order.items || [])[0]?.seller_contact}
              </Text>
            )}

            {/* Leaflet map — shown when seller has a pinned location */}
            {(() => {
              const item = (order.items || [])[0];
              const lat  = Number(item?.seller_lat);
              const lng  = Number(item?.seller_lng);
              if (!lat || !lng) return null;
              const label = `${item?.store_name || 'Seller'}${item?.seller_barangay ? ', ' + item.seller_barangay : ''}, Bago City`;
              return (
                <View style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden', height: 180, borderWidth: 1, borderColor: COLORS.border }}>
                  <LeafletMap lat={lat} lng={lng} label={label} />
                </View>
              );
            })()}

            {/* Navigate button */}
            <TouchableOpacity
              onPress={() => {
                const item = (order.items || [])[0];
                const lat  = item?.seller_lat;
                const lng  = item?.seller_lng;
                const label = `${item?.store_name || 'Seller'}${item?.seller_barangay ? ', ' + item.seller_barangay : ''}, Bago City`;
                openMaps(lat, lng, label);
              }}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 14,
                backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa',
              }}
            >
              <Text style={{ fontSize: 18 }}>🗺️</Text>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#c2410c' }}>Navigate to Seller</Text>
                {(order.items || [])[0]?.seller_lat && Number((order.items || [])[0]?.seller_lat) !== 0 ? (
                  <Text style={{ fontSize: 10, color: '#ea580c', marginTop: 1 }}>📌 Pinned location available</Text>
                ) : (
                  <Text style={{ fontSize: 10, color: '#ea580c', marginTop: 1 }}>Search by address</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Call & Message row — only once approved */}
            {isApproved && (order.items || [])[0]?.seller_contact && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${(order.items || [])[0]?.seller_contact}`)}
                  activeOpacity={0.8}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.blueLight, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' }}
                >
                  <Text style={{ fontSize: 16 }}>📞</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.blue }}>Call Seller</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const riderName = user?.full_name || user?.name || 'Rider';
                    const storeName = (order.items || [])[0]?.store_name || 'Store';
                    const msg = `Good day! I'm ${riderName}, a Bago Riders delivery partner.\n\nI've been approved to pick up order ${order.order_number || '#' + order.id} from your store (${storeName}).\n\nI'm on my way to collect the package. Please have it ready for me.\n\nThank you! 🛵`;
                    Linking.openURL(`sms:${(order.items || [])[0]?.seller_contact}?body=${encodeURIComponent(msg)}`);
                  }}
                  activeOpacity={0.8}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.successLight, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0' }}
                >
                  <Text style={{ fontSize: 16 }}>💬</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#047857' }}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Customer info + location — only after pickup (shipped, out_for_delivery, delivered) */}
        {(isShipped || isInTransit || isDelivered) && (
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
              Deliver To
            </Text>

            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>
              {order.recipient_name || 'Customer'}
            </Text>

            {/* Barangay */}
            {order.barangay_name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Text style={{ fontSize: 14 }}>📍</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text }}>
                  {order.barangay_name}, Bago City
                </Text>
              </View>
            )}

            {/* Street address */}
            {order.street_address && (
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3, marginLeft: 20, lineHeight: 18 }}>
                {order.street_address}
              </Text>
            )}

            {/* Contact */}
            {order.contact_number && (
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 6 }}>
                {order.contact_number}
              </Text>
            )}

            {/* Leaflet map — shown when buyer has a pinned location */}
            {(() => {
              const lat = Number(order.buyer_lat);
              const lng = Number(order.buyer_lng);
              if (!lat || !lng) return null;
              const label = `${order.recipient_name || 'Customer'}${order.barangay_name ? ', ' + order.barangay_name : ''}, Bago City`;
              return (
                <View style={{ marginTop: 14, borderRadius: 14, overflow: 'hidden', height: 180, borderWidth: 1, borderColor: COLORS.border }}>
                  <LeafletMap lat={lat} lng={lng} label={label} />
                </View>
              );
            })()}

            {/* Navigate button */}
            <TouchableOpacity
              onPress={() => {
                const lat   = order.buyer_lat;
                const lng   = order.buyer_lng;
                const label = `${order.recipient_name || 'Customer'}${order.barangay_name ? ', ' + order.barangay_name : ''}, Bago City`;
                openMaps(lat, lng, label);
              }}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 14,
                backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
              }}
            >
              <Text style={{ fontSize: 18 }}>🗺️</Text>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d' }}>Navigate to Customer</Text>
                {order.buyer_lat && Number(order.buyer_lat) !== 0 ? (
                  <Text style={{ fontSize: 10, color: '#16a34a', marginTop: 1 }}>📌 Pinned location available</Text>
                ) : (
                  <Text style={{ fontSize: 10, color: '#16a34a', marginTop: 1 }}>Search by address</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Call & Message row */}
            {order.contact_number && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${order.contact_number}`)}
                  activeOpacity={0.8}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.blueLight, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' }}
                >
                  <Text style={{ fontSize: 16 }}>📞</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.blue }}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const riderName = user?.full_name || user?.name || 'Your rider';
                    const amount    = Number(order.total_amount || 0).toLocaleString();
                    const itemCount = order.items_count || (order.items || []).length;
                    const msg = `Good day! I'm ${riderName}, your Local Market Bago Riders delivery partner.\n\nI'm currently on my way to deliver your order:\n📦 Order: ${order.order_number || '#' + order.id}\n🛒 Items: ${itemCount} item${itemCount > 1 ? 's' : ''}\n💰 Total (COD): ₱${amount}\n\nPlease prepare the exact amount of ₱${amount} for Cash on Delivery payment. Kindly make sure someone is available to receive the package at your address.\n\nIf you have any concerns, please reply to this message or call me directly.\n\nThank you and see you shortly! 🛵`;
                    Linking.openURL(`sms:${order.contact_number}?body=${encodeURIComponent(msg)}`);
                  }}
                  activeOpacity={0.8}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.successLight, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0' }}
                >
                  <Text style={{ fontSize: 16 }}>💬</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#047857' }}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Items */}
        <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
            Items ({order.items_count || (order.items || []).length})
          </Text>
          {(order.items || []).map((item: any, i: number) => {
            const img = buildImg(item.product_image);
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: COLORS.border }}>
                <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#f8f9fb', overflow: 'hidden' }}>
                  {img ? <Image source={{ uri: img }} style={{ width: 48, height: 48 }} /> : <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Text>📷</Text></View>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.text }} numberOfLines={1}>{item.product_name}</Text>
                  {item.variation_label ? (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#1d4ed8', marginTop: 2 }}>{item.variation_label}</Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>x{item.quantity} · {item.store_name || 'Store'}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>₱{Number(item.price * item.quantity).toLocaleString()}</Text>
              </View>
            );
          })}
          {/* Total */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 14, borderTopWidth: 1.5, borderTopColor: COLORS.border }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.textSecondary }}>Collect (COD)</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.primary }}>₱{Number(order.total_amount || 0).toLocaleString()}</Text>
          </View>

          {/* Rider Commission (Shipping Fee) */}
          {Number(order.delivery_fee || order.rider_earning || 0) > 0 && (
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 15 }}>🏍️</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.success }}>Your Commission</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.success }}>
                +₱{Number(order.delivery_fee || order.rider_earning || 0).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Proof Photos */}
        {(order.pickup_proof || order.delivery_proof) && (
          <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>Proof Photos</Text>
            {order.pickup_proof && (
              <View style={{ marginBottom: order.delivery_proof ? 16 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12 }}>📦</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>Pickup</Text>
                  {order.picked_up_at && <Text style={{ fontSize: 10, color: COLORS.textMuted }}>· {formatTime(order.picked_up_at)}</Text>}
                </View>
                <Image source={{ uri: buildImg(order.pickup_proof)! }} style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" />
              </View>
            )}
            {order.delivery_proof && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12 }}>✅</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary }}>Delivery</Text>
                  {order.delivered_at && <Text style={{ fontSize: 10, color: COLORS.textMuted }}>· {formatTime(order.delivered_at)}</Text>}
                </View>
                <Image source={{ uri: buildImg(order.delivery_proof)! }} style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {!isDelivered && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, paddingBottom: insets.bottom + 16, gap: 10, ...SHADOWS.lg }}>

          {/* ── Blocked: rider has an active delivery ── */}
          {isReady && hasActiveDelivery && (
            <View style={{ backgroundColor: '#fef3c7', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: '#fde68a', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🚫</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e' }}>Busy — Active Delivery</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#b45309', lineHeight: 18, marginLeft: 26 }}>
                Complete Order #{activeOrderNum} before requesting or picking up a new order.
              </Text>
            </View>
          )}

          {/* ── Normal actions when rider is free ── */}
          {isReady && !hasActiveDelivery && !isApproved && !hasPendingRequest && (
            <TouchableOpacity onPress={() => doAction('request_pickup')} disabled={loading} activeOpacity={0.85}
              style={{ backgroundColor: COLORS.primary, paddingVertical: 17, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.6 : 1, ...SHADOWS.md }}>
              <Text style={{ fontSize: 18 }}>📦</Text>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Request Pickup</Text>
            </TouchableOpacity>
          )}
          {isReady && !hasActiveDelivery && hasPendingRequest && !isApproved && (
            <View style={{ backgroundColor: COLORS.warningLight, paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fde68a' }}>
              <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 14 }}>Waiting for Seller Approval</Text>
              <Text style={{ color: '#92400e', fontSize: 11, marginTop: 4 }}>Seller will review and approve your request</Text>
            </View>
          )}
          {isReady && !hasActiveDelivery && isApproved && (
            <TouchableOpacity onPress={() => router.push(`/pickup/${order.id}` as any)} disabled={loading} activeOpacity={0.85}
              style={{ backgroundColor: COLORS.primary, paddingVertical: 17, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.6 : 1, ...SHADOWS.md }}>
              <Text style={{ fontSize: 18 }}>📷</Text>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirm Pickup</Text>
            </TouchableOpacity>
          )}
          {isShipped && (
            <>
              <TouchableOpacity onPress={() => doAction('out_for_delivery')} disabled={loading} activeOpacity={0.85}
                style={{ backgroundColor: COLORS.accent, paddingVertical: 17, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: loading ? 0.6 : 1, ...SHADOWS.md }}>
                <Text style={{ fontSize: 18 }}>🛵</Text>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start Delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCancelModal(true)} activeOpacity={0.85}
                style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fecaca' }}>
                <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 13 }}>Cancel Delivery</Text>
              </TouchableOpacity>
            </>
          )}
          {isInTransit && (
            <>
              <TouchableOpacity onPress={() => router.push(`/deliver/${order.id}` as any)} disabled={loading} activeOpacity={0.85}
                style={{ backgroundColor: COLORS.success, paddingVertical: 17, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.6 : 1, ...SHADOWS.md }}>
                <Text style={{ fontSize: 18 }}>📷</Text>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Confirm Delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCancelModal(true)} activeOpacity={0.85}
                style={{ paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fecaca' }}>
                <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 13 }}>Cancel Delivery</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Cancel Modal */}
      <Modal visible={showCancelModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: COLORS.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingHorizontal: 20, paddingBottom: insets.bottom + 20, maxHeight: '85%' }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDark, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>Cancel Delivery</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 }}>Select a reason for cancelling this delivery:</Text>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {CANCEL_REASONS.map(reason => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 15,
                    paddingHorizontal: 16,
                    marginBottom: 8,
                    backgroundColor: selectedReason === reason ? '#eff6ff' : COLORS.bg,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: selectedReason === reason ? COLORS.blue : 'transparent',
                  }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2.5,
                    borderColor: selectedReason === reason ? COLORS.blue : COLORS.borderDark,
                    backgroundColor: selectedReason === reason ? COLORS.blue : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedReason === reason && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                  </View>
                  <Text style={{ fontSize: 14, color: selectedReason === reason ? COLORS.blue : COLORS.text, fontWeight: selectedReason === reason ? '600' : '400' }}>{reason}</Text>
                </TouchableOpacity>
              ))}

              {selectedReason === 'Others' && (
                <TextInput
                  value={otherReason}
                  onChangeText={setOtherReason}
                  placeholder="Please describe the reason..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  style={{
                    backgroundColor: COLORS.card,
                    borderWidth: 1.5,
                    borderColor: COLORS.borderDark,
                    borderRadius: 14,
                    padding: 16,
                    fontSize: 14,
                    minHeight: 80,
                    textAlignVertical: 'top',
                    marginTop: 4,
                    color: COLORS.text,
                  }}
                />
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => { setShowCancelModal(false); setSelectedReason(null); setOtherReason(''); }}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.bg }}
              >
                <Text style={{ fontWeight: '600', fontSize: 14, color: COLORS.textSecondary }}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={cancelDelivery}
                disabled={loading || !selectedReason || (selectedReason === 'Others' && !otherReason.trim())}
                style={{
                  flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
                  backgroundColor: (!selectedReason || (selectedReason === 'Others' && !otherReason.trim())) ? '#fca5a5' : COLORS.danger,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 14, color: '#fff' }}>{loading ? 'Cancelling...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
