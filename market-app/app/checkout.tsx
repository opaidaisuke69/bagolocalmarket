import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Package,
  Truck,
  CreditCard,
} from 'lucide-react-native';
import { ordersAPI, addressesAPI, productsAPI } from '../services/api';
import { IMAGE_BASE_URL } from '../constants/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/ui/Skeleton';
import { COLORS } from '../constants';

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export default function CheckoutScreen() {
  const { itemIds, buyNow, productId, quantity } = useLocalSearchParams<{ itemIds?: string; buyNow?: string; productId?: string; quantity?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items: cartItems, fetchCart } = useCart();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [buyNowProduct, setBuyNowProduct] = useState<any>(null);

  const isBuyNow = buyNow === 'true' && productId;

  // Get selected cart items or buy-now product
  const selectedItemIds = (itemIds || '').split(',').filter(Boolean);
  const checkoutItems = isBuyNow && buyNowProduct
    ? [buyNowProduct]
    : cartItems.filter(i => selectedItemIds.includes(String(i.id)) || selectedItemIds.includes(String(i.product_id)));

  const subtotal = checkoutItems.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity || quantity || 1), 0);
  const deliveryFee = 50;
  const total = subtotal + deliveryFee;

  useEffect(() => {
    const init = async () => {
      try {
        // Fetch addresses
        const addrData = await addressesAPI.list();
        const addrs = addrData.addresses || [];
        setAddresses(addrs);
        const def = addrs.find((a: any) => a.is_default) || addrs[0];
        if (def) setSelectedAddress(def);

        // If Buy Now, fetch product details
        if (isBuyNow && productId) {
          const prodData = await productsAPI.detail(Number(productId));
          const prod = prodData.product;
          setBuyNowProduct({
            id: prod.id,
            product_id: prod.id,
            product_name: prod.name,
            product_image: prod.images?.[0]?.image_url || prod.primary_image,
            price: prod.price,
            quantity: Number(quantity || 1),
            stock: prod.stock,
            store_name: prod.store_name,
          });
        }
      } catch {}
      finally { setLoading(false); }
    };
    init();
  }, []);

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      showToast('Please select a delivery address', 'warning');
      return;
    }
    if (checkoutItems.length === 0) {
      showToast('No items to checkout', 'error');
      return;
    }

    setPlacing(true);
    try {
      const orderItems = checkoutItems.map(item => ({
        product_id: Number(item.product_id || item.id),
        quantity: Number(item.quantity || 1),
      }));

      await ordersAPI.create({
        address_id: selectedAddress.id,
        items: orderItems,
      });

      showToast('Order placed successfully!', 'success');
      if (!isBuyNow) await fetchCart(); // Refresh cart only if from cart
      router.replace('/purchases?tab=pending' as any);
    } catch (err: any) {
      showToast(err.message || 'Failed to place order', 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>
          <Skeleton width={150} height={20} />
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton width="100%" height={80} borderRadius={12} />
          <Skeleton width="100%" height={120} borderRadius={12} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Checkout</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        {/* Delivery Address */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MapPin size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Delivery Address</Text>
          </View>

          {selectedAddress ? (
            <View style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.primary[200] }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[900] }}>{selectedAddress.recipient_name}</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 2 }}>{selectedAddress.contact_number}</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray[600], marginTop: 4 }}>
                {selectedAddress.street_address}{selectedAddress.barangay_name ? `, ${selectedAddress.barangay_name}` : ''}, Bago City
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.gray[200], borderStyle: 'dashed', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>No address found. Please add one.</Text>
            </TouchableOpacity>
          )}

          {/* Address list (if multiple) */}
          {addresses.length > 1 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: COLORS.gray[400], marginBottom: 6 }}>Select address:</Text>
              {addresses.map((addr: any) => (
                <TouchableOpacity
                  key={addr.id}
                  onPress={() => setSelectedAddress(addr)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selectedAddress?.id === addr.id ? COLORS.primary[800] : COLORS.gray[300], alignItems: 'center', justifyContent: 'center' }}>
                    {selectedAddress?.id === addr.id && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary[800] }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.gray[800] }}>{addr.recipient_name} · {addr.contact_number}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.gray[500] }}>{addr.street_address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Order Items */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Package size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Order Items ({checkoutItems.length})</Text>
          </View>

          {checkoutItems.map((item) => {
            const imageUri = buildImageUrl(item.product_image);
            return (
              <View key={item.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f9fafb' }}>
                <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#f8fafc', overflow: 'hidden' }}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={18} color={COLORS.gray[300]} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: COLORS.gray[900] }} numberOfLines={2}>{item.product_name}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>x{item.quantity}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[900] }}>
                  ₱{(Number(item.price) * Number(item.quantity)).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Payment & Delivery */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CreditCard size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Payment Method</Text>
          </View>
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14 }}>💵</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.gray[800] }}>Cash on Delivery (COD)</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Truck size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Delivery</Text>
          </View>
          <Text style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 4, marginLeft: 24 }}>Standard Delivery · ₱{deliveryFee}.00</Text>
        </View>

        {/* Summary */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Subtotal ({checkoutItems.length} items)</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Delivery Fee</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>₱{deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.primary[800] }}>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 14 }}>
          <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>Total Payment</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.primary[800] }}>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
        </View>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={placing || !selectedAddress}
          style={{ backgroundColor: (placing || !selectedAddress) ? COLORS.gray[300] : COLORS.primary[800], paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 }}
        >
          {placing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
