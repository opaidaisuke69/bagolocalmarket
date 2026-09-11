import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { COLORS } from '../../constants';

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { items, loading, fetchWishlist } = useWishlist();

  // Refresh wishlist every time this tab is focused
  useFocusEffect(
    useCallback(() => {
      if (user) fetchWishlist();
    }, [user, fetchWishlist])
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Heart size={52} color={COLORS.gray[300]} />
        <Text style={{ color: COLORS.gray[600], fontSize: 15, fontWeight: '600', marginTop: 16 }}>Your wishlist is empty</Text>
        <Text style={{ color: COLORS.gray[400], fontSize: 12, marginTop: 6, textAlign: 'center' }}>
          Login to save items you love
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/auth/login' as any)}
          style={{ marginTop: 20, backgroundColor: COLORS.primary[800], paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
        <Heart size={20} color="#fff" fill="#fff" />
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Wishlist</Text>
        {items.length > 0 && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{items.length}</Text>
          </View>
        )}
      </View>

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary[800]} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Heart size={56} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontSize: 14, fontWeight: '600', marginTop: 16 }}>No saved items yet</Text>
          <Text style={{ color: COLORS.gray[400], fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            Tap the heart icon on any product to save it here
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/marketplace' as any)}
            style={{ marginTop: 20, backgroundColor: COLORS.primary[800], paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.product_id ?? item.id)}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchWishlist}
              tintColor={COLORS.primary[800]}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={{
                id: Number(item.product_id ?? item.id),
                name: item.product_name,
                price: Number(item.price),
                primary_image: item.product_image,
                stock: Number(item.stock ?? 0),
                is_available: item.is_available,
                category_name: item.category_name,
                store_name: item.store_name || item.seller_name,
                rating: Number((item as any).rating ?? 0),
                sold_count: Number((item as any).sold_count ?? 0),
                barangay_name: (item as any).barangay_name,
              }}
            />
          )}
        />
      )}
    </View>
  );
}
