import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  SlidersHorizontal,
  X,
  Package,
  TrendingUp,
} from 'lucide-react-native';
import { productsAPI, categoriesAPI } from '../../services/api';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Modal } from '../../components/ui/Modal';
import { useDebounce } from '../../hooks/useDebounce';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS, SORT_OPTIONS } from '../../constants';

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

export default function MarketplaceScreen() {
  const params = useLocalSearchParams<{ category?: string; sort?: string; search?: string }>();
  const router = useRouter();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [search, setSearch] = useState(params.search || '');
  const [filters, setFilters] = useState({
    category: params.category || '',
    sort: params.sort || 'newest',
    min_price: '',
    max_price: '',
  });

  const debouncedSearch = useDebounce(search, 500);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    categoriesAPI.list().then(r => setCategories(r.categories || [])).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await productsAPI.list({
        page: pageNum,
        limit: 20,
        search: debouncedSearch || undefined,
        category: filters.category || undefined,
        sort: filters.sort,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
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
  }, [debouncedSearch, filters]);

  useEffect(() => {
    setPage(1);
    fetchProducts(1, false);
  }, [fetchProducts]);

  // Silent poll
  const silentPoll = useCallback(async () => {
    if (products.length === 0) return;
    try {
      const res = await productsAPI.list({
        page: 1, limit: 20,
        search: debouncedSearch || undefined,
        category: filters.category || undefined,
        sort: filters.sort,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
      });
      const fresh = res.products || [];
      setTotal(res.total || 0);
      setProducts(prev => prev.length <= 20 ? fresh : [...fresh, ...prev.slice(20)]);
    } catch {}
  }, [debouncedSearch, filters, products.length]);

  useRealtime(silentPoll, 1500, products.length > 0);

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchProducts(next, true);
  };

  const clearFilters = () => {
    setFilters({ category: '', sort: 'newest', min_price: '', max_price: '' });
    setSearch('');
  };

  const activeFilterCount = [filters.category, filters.min_price || filters.max_price].filter(Boolean).length;

  const insets = useSafeAreaInsets();

  const renderProduct = ({ item }: { item: any }) => <ProductCard product={item} />;

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={COLORS.primary[800]} />
          <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 8 }}>Loading more...</Text>
        </View>
      );
    }
    if (!hasMore && products.length > 0) {
      return (
        <View style={{ paddingVertical: 28, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gray[200], paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 }}>
            <TrendingUp size={13} color={COLORS.gray[400]} />
            <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>You've seen all {total.toLocaleString()} products</Text>
          </View>
        </View>
      );
    }
    return <View style={{ height: 20 }} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ProgressBar visible={loading} />

      {/* ── Header with Search ── */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingHorizontal: 16, paddingBottom: 12, paddingTop: insets.top + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Search input */}
          <View style={{ flex: 1, position: 'relative' }}>
            <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
              <Search size={15} color={COLORS.gray[400]} />
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products..."
              placeholderTextColor={COLORS.gray[400]}
              style={{ backgroundColor: '#fff', borderRadius: 8, paddingLeft: 38, paddingRight: 36, paddingVertical: 9, fontSize: 13, color: COLORS.gray[900] }}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
                <X size={14} color={COLORS.gray[400]} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter btn */}
          <TouchableOpacity
            onPress={() => setShowFilterModal(true)}
            style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: activeFilterCount > 0 ? COLORS.accent[400] : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <SlidersHorizontal size={18} color={activeFilterCount > 0 ? COLORS.primary[900] : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Category Scroll (icon + label, horizontal) ── */}
      {categories.length > 0 && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 4 }}
          >
            {/* "All" button */}
            <TouchableOpacity
              onPress={() => setFilters(prev => ({ ...prev, category: '' }))}
              style={{ alignItems: 'center', paddingHorizontal: 8, width: 64 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: !filters.category ? COLORS.primary[800] : '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 18 }}>🛒</Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: !filters.category ? '700' : '500', color: !filters.category ? COLORS.primary[800] : COLORS.gray[600], textAlign: 'center' }} numberOfLines={1}>
                All
              </Text>
            </TouchableOpacity>

            {categories.map((cat: any) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setFilters(prev => ({ ...prev, category: prev.category === cat.slug ? '' : cat.slug }))}
                style={{ alignItems: 'center', paddingHorizontal: 4, width: 64 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: filters.category === cat.slug ? COLORS.primary[50] : '#f8fafc', alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: filters.category === cat.slug ? 2 : 0, borderColor: COLORS.primary[800] }}>
                  <Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat.slug] || '📦'}</Text>
                </View>
                <Text style={{ fontSize: 9, fontWeight: filters.category === cat.slug ? '700' : '500', color: filters.category === cat.slug ? COLORS.primary[800] : COLORS.gray[600], textAlign: 'center' }} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Sort pills row ── */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setFilters(prev => ({ ...prev, sort: opt.value }))}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: filters.sort === opt.value ? COLORS.primary[800] : '#f3f4f6' }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: filters.sort === opt.value ? '#fff' : COLORS.gray[600] }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Results count ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ fontSize: 11, color: COLORS.gray[500] }}>
          {!loading && total > 0 ? `${total.toLocaleString()} products` : ''}
        </Text>
        {(search || activeFilterCount > 0) && (
          <TouchableOpacity onPress={clearFilters} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <X size={11} color={COLORS.primary[800]} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.primary[800] }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Products ── */}
      {loading ? (
        <ProductListSkeleton count={6} />
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Package size={48} color={COLORS.gray[300]} />
          <Text style={{ color: COLORS.gray[500], fontSize: 13, fontWeight: '500', marginTop: 16, textAlign: 'center' }}>No products found</Text>
          <Text style={{ color: COLORS.gray[400], fontSize: 11, marginTop: 4, textAlign: 'center' }}>Try adjusting your filters or search</Text>
          {(search || activeFilterCount > 0) && (
            <TouchableOpacity onPress={clearFilters} style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={products}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Filter Modal ── */}
      <Modal visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filters">
        <View style={{ gap: 20 }}>
          {/* Sort */}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[500], marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort By</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setFilters(prev => ({ ...prev, sort: opt.value }))}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: filters.sort === opt.value ? COLORS.primary[800] : COLORS.gray[200], backgroundColor: filters.sort === opt.value ? COLORS.primary[800] : '#f9fafb' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '500', color: filters.sort === opt.value ? '#fff' : COLORS.gray[600] }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price */}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[500], marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price Range (₱)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput
                value={filters.min_price}
                onChangeText={(v) => setFilters(prev => ({ ...prev, min_price: v }))}
                placeholder="Min"
                keyboardType="numeric"
                placeholderTextColor={COLORS.gray[400]}
                style={{ flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: COLORS.gray[900] }}
              />
              <Text style={{ color: COLORS.gray[400] }}>—</Text>
              <TextInput
                value={filters.max_price}
                onChangeText={(v) => setFilters(prev => ({ ...prev, max_price: v }))}
                placeholder="Max"
                keyboardType="numeric"
                placeholderTextColor={COLORS.gray[400]}
                style={{ flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: COLORS.gray[900] }}
              />
            </View>
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => { clearFilters(); setShowFilterModal(false); }}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray[200], alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[600] }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: COLORS.primary[800], alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
