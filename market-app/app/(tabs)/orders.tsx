import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Package, ShoppingCart, Trash2 } from 'lucide-react-native';
import { wishlistAPI } from '../../services/api';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';

export default function WishlistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, loading, fetchWishlist } = useWishlist();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Real-time poll wishlist every 1.5s
  const silentPollWishlist = useCallback(async () => {
    if (!user) return;
    await fetchWishlist();
  }, [user, fetchWishlist]);
  useRealtime(silentPollWishlist, 1500, !!user);

  // Map wishlist items to product-like objects for ProductCard
  const products = items.map((item: any) => ({
    id: item.product_id,
    name: item.product_name,
    price: item.price,
    stock: item.stock,
    is_available: item.is_available,
    primary_image: item.product_image,
    category_name: item.category_name,
    store_name: item.store_name,
    rating: item.rating || 0,
    sold_count: item.sold_count || 0,
  }));

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Wishlist</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Heart size={48} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontWeight: '500', marginTop: 16 }}>Login to view your wishlist</Text>
          <TouchableOpacity onPress={() => router.push('/auth/login' as any)} style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ProgressBar visible={loading} />

      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Wishlist</Text>
        <TouchableOpacity onPress={() => router.push('/cart' as any)} style={{ position: 'relative' }}>
          <ShoppingCart size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          <ProductListSkeleton count={4} />
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Heart size={48} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontSize: 13, fontWeight: '500', marginTop: 16 }}>Your wishlist is empty</Text>
          <Text style={{ color: COLORS.gray[400], fontSize: 11, marginTop: 4, textAlign: 'center' }}>Browse products and tap the heart to save them here</Text>
          <TouchableOpacity onPress={() => router.push('/marketplace' as any)} style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductCard product={item} disableWishlistRemove />}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWishlist().then(() => setRefreshing(false)); }} tintColor={COLORS.primary[800]} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}
