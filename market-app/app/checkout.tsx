import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Image, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, MapPin, Package, Truck, CreditCard, Info, Navigation,
  Minus, Plus,
} from 'lucide-react-native';
import { ordersAPI, addressesAPI, productsAPI, cartAPI } from '../services/api';
import { IMAGE_BASE_URL } from '../constants/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/ui/Skeleton';
import { COLORS } from '../constants';

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export default function CheckoutScreen() {
  const { itemIds, buyNow, productId, quantity, variationId, colorVariationId } = useLocalSearchParams<{
    itemIds?: string; buyNow?: string; productId?: string; quantity?: string; variationId?: string; colorVariationId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items: cartItems, fetchCart, updateQuantity } = useCart();
  const { showToast } = useToast();

  const [addresses,       setAddresses]       = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [loading,         setLoading]         = useState(true);
  const [placing,         setPlacing]         = useState(false);
  const [buyNowProduct,   setBuyNowProduct]   = useState<any>(null);

  // Buy-now local quantity (separate from cart — no cart row to update)
  const [buyNowQty, setBuyNowQty] = useState(1);

  // Delivery fee
  const [deliveryFee,  setDeliveryFee]  = useState<number | null>(null);
  const [feeLoading,   setFeeLoading]   = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState('');
  const [feeNote,      setFeeNote]      = useState('');
  const [sellerFees,   setSellerFees]   = useState<any[]>([]);

  // Per-item quantity update tracking
  const [updatingQty, setUpdatingQty] = useState<Record<string, boolean>>({});

  // Track last fetched address+sellers to avoid duplicate calls
  const lastFeeKey = useRef('');

  const isBuyNow        = buyNow === 'true' && !!productId;
  const selectedItemIds = (itemIds || '').split(',').filter(Boolean);

  const checkoutItems = isBuyNow && buyNowProduct
    ? [{ ...buyNowProduct, quantity: buyNowQty }]
    : cartItems.filter(i =>
        selectedItemIds.includes(String(i.id)) ||
        selectedItemIds.includes(String(i.product_id))
      );

  const subtotal = checkoutItems.reduce(
    (sum, i) => sum + Number(i.price) * Number(i.quantity), 0
  );

  // ── Fetch shipping fee ────────────────────────────────────────────────────
  const fetchShippingFee = useCallback(async (addressId: number, items: any[]) => {
    if (!addressId || items.length === 0) return;

    const sellerIds = [...new Set(
      items.map(i => Number(i.seller_id)).filter(id => id > 0)
    )] as number[];

    const feeKey = `${addressId}:${sellerIds.sort().join(',')}`;
    if (feeKey === lastFeeKey.current) return; // already fetched for this combo
    lastFeeKey.current = feeKey;

    setFeeLoading(true);
    setDeliveryFee(null);
    setFeeNote('');

    try {
      const data = await ordersAPI.shippingFee(addressId, sellerIds);
      setDeliveryFee(Number(data.shipping_fee));
      setFeeBreakdown(data.fee_breakdown || '₱5/km · min ₱25');
      setFeeNote(data.note || '');
      setSellerFees(data.sellers || []);
    } catch (err: any) {
      // Fallback: ₱25 minimum
      setDeliveryFee(25);
      setFeeBreakdown('₱5/km · min ₱25');
      setFeeNote('Could not reach fee server. Using minimum ₱25.');
    } finally {
      setFeeLoading(false);
    }
  }, []);

  // Re-fetch when address or items change
  useEffect(() => {
    if (selectedAddress && checkoutItems.length > 0) {
      lastFeeKey.current = ''; // reset so new address always triggers
      fetchShippingFee(selectedAddress.id, checkoutItems);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddress?.id, checkoutItems.map(i => i.seller_id).join(',')]);

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const addrData = await addressesAPI.list();
        const addrs: any[] = addrData.addresses || [];
        setAddresses(addrs);
        const def = addrs.find(a => String(a.is_default) === '1') || addrs[0] || null;
        setSelectedAddress(def);

        if (isBuyNow && productId) {
          const pd = await productsAPI.detail(Number(productId));
          const p  = pd.product;
          const initialQty = Number(quantity || 1);
          setBuyNowQty(initialQty);

          // If a specific variant was selected via Buy Now, use that variant's price/stock
          let effectivePrice = Number(p.price);
          let effectiveStock = Number(p.stock);
          let variationLabel: string | null = null;
          let chosenVariationId: number | null = variationId ? Number(variationId) : null;
          let chosenColorVariationId: number | null = colorVariationId ? Number(colorVariationId) : null;

          const labelParts: string[] = [];

          if (chosenColorVariationId && p.variations?.length > 0) {
            const cv = p.variations.find((pv: any) => Number(pv.id) === chosenColorVariationId);
            if (cv) labelParts.push(`Color: ${cv.value}`);
          }

          if (chosenVariationId && p.variations?.length > 0) {
            const v = p.variations.find((pv: any) => Number(pv.id) === chosenVariationId);
            if (v) {
              effectivePrice = Number(p.price) + Number(v.price_adjustment || 0);
              effectiveStock = Number(v.stock);
              labelParts.push(`${v.name}: ${v.value}`);
            }
          }

          variationLabel = labelParts.length > 0 ? labelParts.join(' · ') : null;

          setBuyNowProduct({
            id:                    p.id,
            product_id:            p.id,
            product_name:          p.name,
            product_image:         p.images?.[0]?.image_url || p.primary_image,
            price:                 effectivePrice,
            quantity:              initialQty,
            stock:                 effectiveStock,
            store_name:            p.store_name,
            seller_id:             p.seller_id,
            variation_id:          chosenVariationId,
            color_variation_id:    chosenColorVariationId,
            variation_label:       variationLabel,
          });
        }
      } catch {}
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Change item quantity ─────────────────────────────────────────────────
  // Buy-now: updates local buyNowQty state only (no cart row exists)
  // Cart:    calls cartAPI directly + fetchCart so UI is guaranteed to sync
  const changeQty = async (item: any, delta: number) => {
    const currentQty = isBuyNow ? buyNowQty : Number(item.quantity);
    const newQty     = currentQty + delta;
    const maxStock   = Number(item.stock ?? 0);
    if (newQty < 1) return;
    if (maxStock > 0 && newQty > maxStock) return;

    if (isBuyNow) {
      // Buy-now: just update local state
      setBuyNowQty(newQty);
      return;
    }

    // Cart mode: update via API then re-sync context
    const key = String(item.id);
    setUpdatingQty(prev => ({ ...prev, [key]: true }));
    try {
      await cartAPI.update({ item_id: Number(item.id), quantity: newQty });
      await fetchCart(); // re-sync context so checkoutItems qty updates
    } catch {
      showToast('Failed to update quantity', 'error');
    } finally {
      setUpdatingQty(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Place order ───────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!selectedAddress)        { showToast('Please select a delivery address', 'warning'); return; }
    if (checkoutItems.length === 0) { showToast('No items to checkout', 'error'); return; }

    setPlacing(true);
    try {
      await ordersAPI.create({
        address_id:   selectedAddress.id,
        items:        checkoutItems.map(item => ({
          product_id:          Number(item.product_id || item.id),
          quantity:            Number(item.quantity || 1),
          variation_id:        item.variation_id       ?? null,
          color_variation_id:  item.color_variation_id ?? null,
        })),
        shipping_fee: deliveryFee ?? 25,
      });
      showToast('Order placed successfully!', 'success');
      if (!isBuyNow) await fetchCart();
      router.replace('/purchases?tab=pending' as any);
    } catch (err: any) {
      showToast(err.message || 'Failed to place order', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const effectiveFee = deliveryFee ?? 0;
  const total        = subtotal + effectiveFee;
  const feeReady     = !feeLoading && deliveryFee !== null;
  const canPlace     = feeReady && !!selectedAddress && !placing;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>
          <Skeleton width={150} height={20} />
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton width="100%" height={80}  borderRadius={12} />
          <Skeleton width="100%" height={120} borderRadius={12} />
          <Skeleton width="100%" height={100} borderRadius={12} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>

      {/* ── Header ── */}
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Checkout</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ── Delivery Address ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MapPin size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Delivery Address</Text>
          </View>

          {selectedAddress ? (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: '#bbf7d0' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>{selectedAddress.recipient_name}</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray[500], marginTop: 1 }}>{selectedAddress.contact_number}</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray[700], marginTop: 4, lineHeight: 17 }}>
                {selectedAddress.street_address}
                {selectedAddress.barangay_name ? `, ${selectedAddress.barangay_name}` : ''}, Bago City
              </Text>
              {/* GPS status */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                <Navigation size={10} color={selectedAddress.latitude ? '#16a34a' : '#f59e0b'} />
                <Text style={{ fontSize: 10, color: selectedAddress.latitude ? '#16a34a' : '#f59e0b', fontWeight: '600' }}>
                  {selectedAddress.latitude
                    ? `GPS pinned · ${Number(selectedAddress.latitude).toFixed(4)}, ${Number(selectedAddress.longitude).toFixed(4)}`
                    : 'No GPS pin — fee may be estimated'}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/address/add' as any)}
              style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.gray[200], borderStyle: 'dashed', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>No address. Tap to add one.</Text>
            </TouchableOpacity>
          )}

          {/* Address selector */}
          {addresses.length > 1 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: COLORS.gray[400], marginBottom: 6, fontWeight: '600' }}>Change address:</Text>
              {addresses.map((addr: any) => (
                <TouchableOpacity
                  key={addr.id}
                  onPress={() => {
                    lastFeeKey.current = '';
                    setSelectedAddress(addr);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}
                >
                  <View style={{
                    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                    borderColor: selectedAddress?.id === addr.id ? COLORS.primary[800] : COLORS.gray[300],
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selectedAddress?.id === addr.id && (
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary[800] }} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[800] }}>
                      {addr.recipient_name} · {addr.contact_number}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.gray[500] }}>
                      {addr.street_address}{addr.barangay_name ? `, ${addr.barangay_name}` : ''}
                    </Text>
                    {!addr.latitude && (
                      <Text style={{ fontSize: 10, color: '#f59e0b', marginTop: 1 }}>⚠ No GPS pin</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Order Items ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Package size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>
              Order Items ({checkoutItems.length})
            </Text>
          </View>

          {checkoutItems.map((item) => {
            const uri        = buildImageUrl(item.product_image);
            const qty        = isBuyNow ? buyNowQty : Number(item.quantity || 1);
            const maxStock   = Number(item.stock ?? 0);
            const isUpdating = !isBuyNow && !!updatingQty[String(item.id)];
            const canDec     = !isUpdating && qty > 1;
            const canInc     = !isUpdating && (maxStock === 0 || qty < maxStock);

            return (
              <View
                key={`${item.id}-${item.product_id}`}
                style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}
              >
                {/* Thumbnail */}
                <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f3f4f6', overflow: 'hidden', flexShrink: 0 }}>
                  {uri
                    ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Package size={20} color={COLORS.gray[300]} /></View>
                  }
                </View>

                {/* Info + stepper */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: COLORS.gray[900], lineHeight: 16 }} numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  {item.store_name
                    ? <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 2 }}>{item.store_name}</Text>
                    : null
                  }
                  {item.variation_label
                    ? <Text style={{ fontSize: 10, color: COLORS.primary[700], fontWeight: '600', marginTop: 2 }}>{item.variation_label}</Text>
                    : null
                  }

                  {/* ── Stepper (all modes) ── */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    {/* − */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => changeQty(item, -1)}
                      disabled={!canDec}
                      style={{
                        width: 34, height: 34,
                        borderWidth: 1.5,
                        borderColor: canDec ? COLORS.primary[800] : COLORS.gray[200],
                        borderRadius: 8,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: canDec ? COLORS.primary[50] : '#f9fafb',
                      }}
                    >
                      <Minus size={15} color={canDec ? COLORS.primary[800] : COLORS.gray[300]} />
                    </TouchableOpacity>

                    {/* Count */}
                    <View style={{ width: 42, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                      {isUpdating
                        ? <ActivityIndicator size="small" color={COLORS.primary[800]} />
                        : <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.gray[900] }}>{qty}</Text>
                      }
                    </View>

                    {/* + */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => changeQty(item, 1)}
                      disabled={!canInc}
                      style={{
                        width: 34, height: 34,
                        borderWidth: 1.5,
                        borderColor: canInc ? COLORS.primary[800] : COLORS.gray[200],
                        borderRadius: 8,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: canInc ? COLORS.primary[50] : '#f9fafb',
                      }}
                    >
                      <Plus size={15} color={canInc ? COLORS.primary[800] : COLORS.gray[300]} />
                    </TouchableOpacity>

                    {maxStock > 0 && (
                      <Text style={{ fontSize: 10, color: COLORS.gray[400], marginLeft: 8 }}>
                        {maxStock} avail.
                      </Text>
                    )}
                  </View>
                </View>

                {/* Line total */}
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary[800], alignSelf: 'center' }}>
                  ₱{(Number(item.price) * qty).toLocaleString('en-PH')}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Payment & Delivery Fee ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          {/* Payment method */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CreditCard size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Payment Method</Text>
          </View>
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14 }}>💵</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.gray[800] }}>Cash on Delivery (COD)</Text>
          </View>

          {/* Delivery fee */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Truck size={16} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>Delivery Fee</Text>
          </View>

          <View style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: 14 }}>
            {feeLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color={COLORS.primary[800]} />
                <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Calculating based on GPS distance…</Text>
              </View>
            ) : (
              <>
                {/* Main fee row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[800] }}>Standard Delivery</Text>
                    {feeBreakdown !== '' && (
                      <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 2 }}>{feeBreakdown}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.primary[800] }}>
                    ₱{effectiveFee.toFixed(0)}
                  </Text>
                </View>

                {/* Single seller distance row */}
                {sellerFees.length === 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: '#eff6ff', borderRadius: 7, padding: 8 }}>
                    <MapPin size={11} color={COLORS.primary[800]} />
                    <Text style={{ fontSize: 11, color: COLORS.primary[800], flex: 1 }}>
                      {sellerFees[0].store_name || sellerFees[0].seller_barangay} → {selectedAddress?.barangay_name || 'your location'} · {sellerFees[0].distance_km} km
                      {sellerFees[0].method === 'gps' ? ' (GPS)' : ' (estimated)'}
                    </Text>
                  </View>
                )}

                {/* Multi-seller breakdown */}
                {sellerFees.length > 1 && (
                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.gray[500], marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Per-shop breakdown (fees are summed)
                    </Text>
                    {sellerFees.map((s: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.gray[700] }}>
                            {s.store_name || 'Shop'}{s.method === 'gps' ? ' 📍' : ''}
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>
                            {s.seller_barangay} · {s.distance_km} km
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary[800] }}>₱{s.fee}</Text>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[600] }}>Total Shipping</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary[800] }}>₱{effectiveFee.toFixed(0)}</Text>
                    </View>
                  </View>
                )}

                {/* Warning when GPS missing */}
                {feeNote !== '' && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#fef9c3', borderRadius: 7, padding: 8 }}>
                    <Info size={12} color="#92400e" style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 10, color: '#92400e', flex: 1, lineHeight: 15 }}>{feeNote}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Order Summary ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>
              Subtotal ({checkoutItems.length} item{checkoutItems.length !== 1 ? 's' : ''})
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>
              ₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>Delivery Fee</Text>
            {feeLoading ? (
              <ActivityIndicator size="small" color={COLORS.gray[400]} />
            ) : (
              <Text style={{ fontSize: 12, color: COLORS.gray[700] }}>₱{effectiveFee.toFixed(2)}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Total</Text>
            {feeLoading ? (
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.gray[400] }}>Calculating…</Text>
            ) : (
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.primary[800] }}>
                ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Text>
            )}
          </View>
        </View>

      </ScrollView>

      {/* ── Place Order bar ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <View style={{ flex: 1, marginRight: 14 }}>
          <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>Total Payment</Text>
          {feeLoading ? (
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.gray[400] }}>Calculating…</Text>
          ) : (
            <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.primary[800] }}>
              ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={!canPlace}
          style={{
            backgroundColor: canPlace ? COLORS.primary[800] : COLORS.gray[300],
            paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10,
          }}
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
