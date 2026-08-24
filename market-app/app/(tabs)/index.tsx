import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  ShoppingCart,
  Star,
  TrendingUp,
  Sparkles,
  Package,
  ChevronRight,
} from 'lucide-react-native';
import { productsAPI, categoriesAPI, recommendationsAPI } from '../../services/api';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useRealtime } from '../../hooks/useRealtime';
import { useCart } from '../../context/CartContext';
import { COLORS, CATEGORIES } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CATEGORY_ITEM_SIZE = (SCREEN_WIDTH - 32) / 5; // 5 per row

const CATEGORY_ICONS: Record<string, string> = {
  'food-beverages': '🍽️',
  'clothing': '👕',
  'electronics': '📱',
  'home-living': '🏠',
  'beauty-personal-care': '✨',
  'agriculture': '🌿',
  'local-products': '📍',
  'handmade-products': '🤲',
  'school-supplies': '📚',
  'accessories': '⌚',
};

export default function HomeScreen() {
  const router = useRouter();
  const { count } = useCart();

  const [featured, setFeatured] = useState<any[]>([]);
  const [newProducts, setNewProducts] = useState<any[]>([]);
  const [popular, setPopular] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [categories, setCategories] = useState(CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [featuredRes, newRes, popularRes, recsRes, catsRes] = await Promise.all([
        productsAPI.list({ sort: 'rating', limit: 8 }),
        productsAPI.list({ sort: 'newest', limit: 8 }),
        productsAPI.list({ sort: 'popular', limit: 8 }),
        recommendationsAPI.get({ type: 'for_you', limit: 8 }).catch(() => ({ recommendations: [] })),
        categoriesAPI.list().catch(() => ({ categories: [] })),
      ]);
      setFeatured(featuredRes.products || []);
      setNewProducts(newRes.products || []);
      setPopular(popularRes.products || []);
      setRecommendations(recsRes.recommendations || []);
      if (catsRes.categories?.length > 0) setCategories(catsRes.categories);
      setApiAvailable(true);
    } catch {
      setApiAvailable(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time polling every 3s
  const silentPoll = useCallback(async () => {
    if (!apiAvailable) return;
    try {
      const [popularRes, recsRes] = await Promise.all([
        productsAPI.list({ sort: 'popular', limit: 8 }),
        recommendationsAPI.get({ type: 'for_you', limit: 8 }).catch(() => ({ recommendations: [] })),
      ]);
      setPopular(popularRes.products || []);
      setRecommendations(recsRes.recommendations || []);
    } catch {}
  }, [apiAvailable]);

  useRealtime(silentPoll, 1500, apiAvailable);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const insets = useSafeAreaInsets();

  // Deduplicated product grid
  const allProducts = [...recommendations, ...featured, ...popular, ...newProducts]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ProgressBar visible={loading} />

      {/* ── Header with status bar background ── */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Search bar */}
          <TouchableOpacity
            onPress={() => router.push('/search')}
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
          >
            <Search size={16} color={COLORS.gray[400]} />
            <Text style={{ color: COLORS.gray[400], fontSize: 13, flex: 1 }}>Search products...</Text>
          </TouchableOpacity>

          {/* Cart */}
          <TouchableOpacity onPress={() => router.push('/cart')} style={{ position: 'relative' }}>
            <ShoppingCart size={24} color="#fff" />
            {count > 0 && (
              <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.accent[400], borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.primary[900] }}>{count > 99 ? '99+' : count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary[800]} />}
      >
        {/* ── Categories Grid (2 rows x 5 columns like Shopee) ── */}
        <View style={{ backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 6, borderBottomColor: '#f3f4f6' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {categories.slice(0, 10).map((cat: any) => (
              <TouchableOpacity
                key={cat.id || cat.slug}
                onPress={() => router.push(`/marketplace?category=${cat.slug}` as any)}
                style={{ width: CATEGORY_ITEM_SIZE, alignItems: 'center', paddingVertical: 8 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 22 }}>{CATEGORY_ICONS[cat.slug] || '📦'}</Text>
                </View>
                <Text style={{ fontSize: 10, color: COLORS.gray[700], textAlign: 'center', fontWeight: '500' }} numberOfLines={2}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Promo Banner ── */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f3f4f6' }}>
          <View style={{ backgroundColor: COLORS.primary[800], borderRadius: 12, padding: 20, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Sparkles size={12} color={COLORS.accent[400]} />
              <Text style={{ color: COLORS.accent[400], fontSize: 10, fontWeight: '700' }}>BAGO MARKETPLACE</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
              Your Local Community Store
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 12 }}>
              Fresh produce, handmade crafts & more from Bago City
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/marketplace' as any)}
              style={{ alignSelf: 'flex-start', backgroundColor: COLORS.accent[400], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: COLORS.primary[900], fontSize: 12, fontWeight: '700' }}>Shop Now</Text>
              <ChevronRight size={12} color={COLORS.primary[900]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Products Section ── */}
        {loading ? (
          <View style={{ paddingTop: 12 }}>
            <ProductListSkeleton count={6} />
          </View>
        ) : !apiAvailable ? (
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 }}>
            <Package size={48} color={COLORS.gray[300]} />
            <Text style={{ color: COLORS.gray[500], fontSize: 13, fontWeight: '500', marginTop: 16, textAlign: 'center' }}>
              Unable to connect to server
            </Text>
            <Text style={{ color: COLORS.gray[400], fontSize: 11, marginTop: 4, textAlign: 'center' }}>
              Make sure your server is running
            </Text>
            <TouchableOpacity onPress={() => fetchData()} style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Section Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#f3f4f6' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color={COLORS.primary[800]} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>RECOMMENDED FOR YOU</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/marketplace' as any)}>
                <Text style={{ fontSize: 11, color: COLORS.primary[800], fontWeight: '600' }}>See All ›</Text>
              </TouchableOpacity>
            </View>

            {/* 2 Column Product Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, paddingBottom: 20, backgroundColor: '#f3f4f6' }}>
              {allProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>

            {allProducts.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/marketplace' as any)}
                style={{ marginHorizontal: 16, marginBottom: 20, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.primary[200], borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary[50] }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.primary[800] }}>View All Products ›</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
