import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, ShoppingCart, Package, Minus, Plus, Store, Check, Square, CheckSquare } from 'lucide-react-native';
import { IMAGE_BASE_URL } from '../constants/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';
import { COLORS } from '../constants';

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export default function CartScreen() {
  const router = useRouter();
  const { items, count, total, loading, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Selected items for checkout
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  // Calculate selected total
  const selectedTotal = useMemo(() => {
    return items
      .filter(i => selectedIds.has(i.id))
      .reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  }, [items, selectedIds]);

  const selectedCount = useMemo(() => {
    return items
      .filter(i => selectedIds.has(i.id))
      .reduce((sum, i) => sum + Number(i.quantity), 0);
  }, [items, selectedIds]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' }}>
        <ShoppingCart size={48} color={COLORS.gray[300]} />
        <Text style={{ color: COLORS.gray[500], fontWeight: '500', marginTop: 16 }}>Login to view your cart</Text>
        <TouchableOpacity onPress={() => router.push('/auth/login' as any)} style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group items by store
  const groupedByStore: Record<string, typeof items> = {};
  items.forEach(item => {
    const store = item.store_name || 'Store';
    if (!groupedByStore[store]) groupedByStore[store] = [];
    groupedByStore[store].push(item);
  });
  const storeGroups = Object.entries(groupedByStore);

  const toggleStore = (storeItems: typeof items) => {
    const storeIds = storeItems.map(i => i.id);
    const allStoreSelected = storeIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allStoreSelected) {
        storeIds.forEach(id => next.delete(id));
      } else {
        storeIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const renderItem = ({ item }: { item: [string, typeof items] }) => {
    const [storeName, storeItems] = item;
    const storeIds = storeItems.map(i => i.id);
    const allStoreSelected = storeIds.every(id => selectedIds.has(id));

    return (
      <View style={{ backgroundColor: '#fff', marginBottom: 8 }}>
        {/* Store header with checkbox */}
        <TouchableOpacity
          onPress={() => toggleStore(storeItems)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}
        >
          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: allStoreSelected ? COLORS.primary[800] : COLORS.gray[300], backgroundColor: allStoreSelected ? COLORS.primary[800] : '#fff', alignItems: 'center', justifyContent: 'center' }}>
            {allStoreSelected && <Check size={12} color="#fff" />}
          </View>
          <Store size={14} color={COLORS.primary[800]} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[900], flex: 1 }}>{storeName}</Text>
        </TouchableOpacity>

        {/* Items */}
        {storeItems.map((cartItem) => {
          const imageUri = buildImageUrl(cartItem.product_image);
          const isSelected = selectedIds.has(cartItem.id);

          return (
            <View key={cartItem.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}>
              {/* Checkbox */}
              <TouchableOpacity onPress={() => toggleItem(cartItem.id)}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: isSelected ? COLORS.primary[800] : COLORS.gray[300], backgroundColor: isSelected ? COLORS.primary[800] : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <Check size={12} color="#fff" />}
                </View>
              </TouchableOpacity>

              {/* Image */}
              <TouchableOpacity onPress={() => router.push(`/product/${cartItem.product_id}` as any)} style={{ width: 76, height: 76, borderRadius: 8, backgroundColor: '#f8fafc', overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' }}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={22} color={COLORS.gray[300]} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Details */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: COLORS.gray[900], lineHeight: 16 }} numberOfLines={2}>
                  {cartItem.product_name}
                </Text>
                {cartItem.variation_label ? (
                  <Text style={{ fontSize: 10, color: COLORS.primary[700], fontWeight: '600', marginTop: 2 }}>
                    {cartItem.variation_label}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary[800], marginTop: 4 }}>
                  ₱{Number(cartItem.price).toLocaleString()}
                </Text>

                {/* Quantity + delete */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: 6, overflow: 'hidden' }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (cartItem.quantity <= 1) removeFromCart(cartItem.id);
                        else updateQuantity(cartItem.id, cartItem.quantity - 1);
                      }}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#f9fafb' }}
                    >
                      <Minus size={11} color={COLORS.gray[600]} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[900], paddingHorizontal: 12, paddingVertical: 5 }}>
                      {cartItem.quantity}
                    </Text>
                    <TouchableOpacity
                      onPress={() => updateQuantity(cartItem.id, Math.min(cartItem.stock, cartItem.quantity + 1))}
                      style={{ paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#f9fafb' }}
                    >
                      <Plus size={11} color={COLORS.gray[600]} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => removeFromCart(cartItem.id)} style={{ padding: 6 }}>
                    <Trash2 size={15} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }}>Shopping Cart ({count})</Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 12 }}>
              <Skeleton width={76} height={76} borderRadius={8} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="80%" height={14} />
                <Skeleton width="40%" height={16} />
                <Skeleton width={100} height={28} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <ShoppingCart size={56} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontSize: 14, fontWeight: '500', marginTop: 16 }}>Your cart is empty</Text>
          <Text style={{ color: COLORS.gray[400], fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            Add some products to get started
          </Text>
          <TouchableOpacity onPress={() => router.push('/marketplace' as any)} style={{ marginTop: 20, backgroundColor: COLORS.primary[800], paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={storeGroups}
            keyExtractor={([store]) => store}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 90 }}
          />

          {/* Bottom checkout bar with select all */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Select All */}
              <TouchableOpacity onPress={toggleAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: allSelected ? COLORS.primary[800] : COLORS.gray[300], backgroundColor: allSelected ? COLORS.primary[800] : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  {allSelected && <Check size={12} color="#fff" />}
                </View>
                <Text style={{ fontSize: 12, color: COLORS.gray[600] }}>All</Text>
              </TouchableOpacity>

              {/* Total */}
              <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>Total</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary[800] }}>
                  ₱{selectedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Checkout button */}
              <TouchableOpacity
                onPress={() => {
                  const ids = Array.from(selectedIds).join(',');
                  router.push(`/checkout?itemIds=${ids}` as any);
                }}
                disabled={selectedIds.size === 0}
                style={{ backgroundColor: selectedIds.size > 0 ? COLORS.primary[800] : COLORS.gray[300], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  Checkout ({selectedCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
