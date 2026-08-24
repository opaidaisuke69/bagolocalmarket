import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  MapPin,
  Package,
  ShoppingBag,
  Store,
} from 'lucide-react-native';
import { productsAPI } from '../../services/api';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';

export default function StoreScreen() {
  const { sellerId, storeName, sellerName, sellerRating, sellerSales, sellerBarangay } = useLocalSearchParams<{
    sellerId: string;
    storeName?: string;
    sellerName?: string;
    sellerRating?: string;
    sellerSales?: string;
    sellerBarangay?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await productsAPI.list({
        seller_id: Number(sellerId),
        page: pageNum,
        limit: 20,
      });
      const data = res.products || [];
      setProducts(prev => append ? [...prev, ...data] : data);
      setTotal(res.total || 0);
      setHasMore(pageNum < (res.total_pages || 1));
    } catch {
      if (!append) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sellerId]);

  useEffect(() => { fetchProducts(1); }, [fetchProducts]);

  // Real-time poll store products every 1.5s
  const silentPollStore = useCallback(async () => {
    if (products.length === 0) return;
    try {
      const res = await productsAPI.list({ seller_id: Number(sellerId), page: 1, limit: 20 });
      const data = res.products || [];
      setTotal(res.total || 0);
      setProducts(prev => prev.length <= 20 ? data : [...data, ...prev.slice(20)]);
    } catch {}
  }, [sellerId, products.length]);
  useRealtime(silentPollStore, 1500, products.length > 0);

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchProducts(next, true);
  };

  // Calculate store rating from actual product ratings
  const storeRating = (() => {
    const ratedProducts = products.filter((p: any) => Number(p.rating) > 0);
    if (ratedProducts.length === 0) return Number(sellerRating || 0);
    const sum = ratedProducts.reduce((acc: number, p: any) => acc + Number(p.rating), 0);
    return sum / ratedProducts.length;
  })();
  const sales = Number(sellerSales || 0);

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={COLORS.primary[800]} />
          <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 6 }}>Loading more...</Text>
        </View>
      );
    }
    if (!hasMore && products.length > 0) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>All products shown</Text>
        </View>
      );
    }
    return <View style={{ height: insets.bottom + 20 }} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ProgressBar visible={loading} />

      {/* ── Header ── */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16 }}>
        {/* Back button row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {storeName || 'Store'}
          </Text>
        </View>

        {/* Store profile card */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Store avatar */}
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}>
            <Store size={22} color="#fff" />
          </View>

          {/* Store info */}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{storeName || 'Store'}</Text>
            {sellerName && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{sellerName}</Text>}
            {sellerBarangay && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={10} color="rgba(255,255,255,0.6)" />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{sellerBarangay}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', marginTop: 14, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
            <Star size={12} color={COLORS.accent[400]} fill={COLORS.accent[400]} />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{storeRating.toFixed(1)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>Rating</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
            <Package size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{total}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>Products</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
            <ShoppingBag size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>₱{sales.toLocaleString()}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>Sales</Text>
          </View>
        </View>
      </View>

      {/* ── Products ── */}
      {loading ? (
        <View style={{ paddingTop: 16 }}>
          <ProductListSkeleton count={6} />
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Package size={48} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontSize: 13, fontWeight: '500', marginTop: 16 }}>No products yet</Text>
          <Text style={{ color: COLORS.gray[400], fontSize: 11, marginTop: 4, textAlign: 'center' }}>
            This seller hasn't listed any products
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductCard product={item} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12 }}
        />
      )}
    </View>
  );
}
