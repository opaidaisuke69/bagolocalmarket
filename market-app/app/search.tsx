import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search as SearchIcon,
  X,
  Clock,
  TrendingUp,
  SlidersHorizontal,
  Tag,
  Trash2,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchAPI, categoriesAPI } from '../services/api';
import { ProductCard } from '../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { COLORS } from '../constants';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_LOCAL_HISTORY   = 15;

const CATEGORY_ICONS: Record<string, string> = {
  'food-beverages':       '🍽️',
  'clothing':             '👕',
  'electronics':          '📱',
  'home-living':          '🏠',
  'beauty-personal-care': '✨',
  'agriculture':          '🌿',
  'local-products':       '📍',
  'handmade-products':    '🤲',
  'school-supplies':      '📚',
  'accessories':          '⌚',
};

const POPULAR_SEARCHES_FALLBACK = [
  'Fresh Vegetables', 'Electronics', 'Handmade Crafts',
  'School Supplies', 'Clothing', 'Local Products',
];

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery]                         = useState(params.q || '');
  const [selectedCategory, setSelectedCategory]   = useState(params.category || '');
  const [results, setResults]                     = useState<any[]>([]);
  const [categories, setCategories]               = useState<any[]>([]);
  const [suggestions, setSuggestions]             = useState<string[]>([]);
  const [recentSearches, setRecentSearches]       = useState<string[]>([]);
  const [popularSearches, setPopularSearches]     = useState<{ query: string; search_count: number }[]>([]);
  const [loading, setLoading]                     = useState(false);
  const [hasSearched, setHasSearched]             = useState(false);
  const [total, setTotal]                         = useState(0);
  const [page, setPage]                           = useState(1);
  const [hasMore, setHasMore]                     = useState(false);
  const [loadingMore, setLoadingMore]             = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  // ── Load categories and local recent searches on mount ──────────────────────
  useEffect(() => {
    categoriesAPI.list()
      .then(r => setCategories(r.categories || []))
      .catch(() => {});

    loadLocalHistory();

    // Fetch popular searches from all buyers — no auth required
    searchAPI.popular(10)
      .then(r => {
        const list = r.popular || [];
        if (list.length > 0) setPopularSearches(list);
      })
      .catch(() => {}); // silently fall back to hardcoded list
  }, []);

  const loadLocalHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch {}

    // Also try fetching from server (authenticated users get server-side history)
    try {
      const data = await searchAPI.history();
      const serverHistory: string[] = data.history || [];
      if (serverHistory.length > 0) {
        setRecentSearches(prev => {
          const merged = [...serverHistory, ...prev.filter(t => !serverHistory.includes(t))];
          return merged.slice(0, MAX_LOCAL_HISTORY);
        });
      }
    } catch {}
  };

  const saveToLocalHistory = async (term: string) => {
    if (!term.trim()) return;
    setRecentSearches(prev => {
      const next = [term, ...prev.filter(t => t !== term)].slice(0, MAX_LOCAL_HISTORY);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const removeFromHistory = async (term: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(t => t !== term);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    // Also remove from server silently
    searchAPI.deleteHistory(term).catch(() => {});
  };

  const clearAllHistory = async () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch(() => {});
    searchAPI.clearHistory().catch(() => {});
  };

  // ── Debounced search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setSuggestions([]);
      setHasSearched(false);
      setTotal(0);
      return;
    }
    doSearch(debouncedQuery, selectedCategory, 1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedCategory]);

  const doSearch = useCallback(async (
    q: string,
    category: string,
    pageNum: number,
    append: boolean,
  ) => {
    if (pageNum === 1) {
      setLoading(true);
      setHasSearched(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await searchAPI.search({ q, category: category || undefined, page: pageNum, limit: 20 });
      const products: any[] = data.products || [];
      setResults(prev => append ? [...prev, ...products] : products);
      setSuggestions((data.suggestions || []).map((s: any) => s.name || s));
      setTotal(data.total || 0);
      setPage(pageNum);
      setHasMore(pageNum < (data.total_pages || 1));

      // Persist to local history on first page
      if (pageNum === 1 && q.trim()) {
        saveToLocalHistory(q.trim());
      }
    } catch {
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMore = () => {
    if (!hasMore || loadingMore || loading || !debouncedQuery.trim()) return;
    doSearch(debouncedQuery, selectedCategory, page + 1, true);
  };

  const handleHistoryPress = (term: string) => {
    setQuery(term);
    Keyboard.dismiss();
  };

  const handleCategorySelect = (slug: string) => {
    const next = selectedCategory === slug ? '' : slug;
    setSelectedCategory(next);
    if (debouncedQuery.trim()) {
      doSearch(debouncedQuery, next, 1, false);
    }
  };

  // ── Footer for FlatList ──────────────────────────────────────────────────────
  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={COLORS.primary[800]} />
        </View>
      );
    }
    if (!hasMore && results.length > 0) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>
            {total.toLocaleString()} result{total !== 1 ? 's' : ''} shown
          </Text>
        </View>
      );
    }
    return <View style={{ height: 20 }} />;
  };

  // ── Header component (rendered above results inside FlatList) ────────────────
  const ListHeader = () => (
    <View>
      {/* Category filter chips */}
      {categories.length > 0 && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}
          >
            {/* "All" chip */}
            <TouchableOpacity
              onPress={() => handleCategorySelect('')}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: !selectedCategory ? COLORS.primary[800] : '#f3f4f6',
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedCategory ? '#fff' : COLORS.gray[600] }}>
                All
              </Text>
            </TouchableOpacity>

            {categories.map((cat: any) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => handleCategorySelect(cat.slug)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: selectedCategory === cat.slug ? COLORS.primary[800] : '#f3f4f6',
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}
              >
                <Text style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat.slug] || '📦'}</Text>
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: selectedCategory === cat.slug ? '#fff' : COLORS.gray[600],
                }}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Category suggestions from search */}
      {hasSearched && suggestions.length > 0 && (
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.gray[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Category Matches
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {suggestions.map((name: string) => {
              const cat = categories.find((c: any) => c.name === name);
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => cat && handleCategorySelect(cat.slug)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: COLORS.primary[50], borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderWidth: 1, borderColor: COLORS.primary[200],
                  }}
                >
                  <Tag size={11} color={COLORS.primary[700]} />
                  <Text style={{ fontSize: 12, color: COLORS.primary[700], fontWeight: '600' }}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Results count */}
      {hasSearched && !loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>
            {total > 0
              ? <>{total.toLocaleString()} result{total !== 1 ? 's' : ''} for <Text style={{ fontWeight: '700', color: COLORS.gray[800] }}>"{query}"</Text></>
              : `No results for "${query}"`}
          </Text>
          {selectedCategory && (
            <TouchableOpacity onPress={() => handleCategorySelect('')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <X size={11} color={COLORS.primary[800]} />
              <Text style={{ fontSize: 11, color: COLORS.primary[800], fontWeight: '600' }}>
                {categories.find((c: any) => c.slug === selectedCategory)?.name || selectedCategory}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }} edges={['top']}>
      {/* ── Search Header ─────────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingHorizontal: 16, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, position: 'relative' }}>
          <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
            <SearchIcon size={15} color={COLORS.gray[400]} />
          </View>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products, categories..."
            placeholderTextColor={COLORS.gray[400]}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => { if (query.trim()) doSearch(query.trim(), selectedCategory, 1, false); Keyboard.dismiss(); }}
            style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              paddingLeft: 38,
              paddingRight: query ? 36 : 14,
              paddingVertical: 9,
              fontSize: 13,
              color: COLORS.gray[900],
            }}
          />
          {query ? (
            <TouchableOpacity
              onPress={() => { setQuery(''); setResults([]); setSuggestions([]); setHasSearched(false); }}
              style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              <X size={14} color={COLORS.gray[400]} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Pre-search state: recent + popular ────────────────────────────────── */}
      {!hasSearched ? (
        <ScrollView
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Category quick-select */}
          {categories.length > 0 && (
            <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}
              >
                {categories.map((cat: any) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      setSelectedCategory(cat.slug);
                      router.push(`/marketplace?category=${cat.slug}` as any);
                    }}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: '#f3f4f6',
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat.slug] || '📦'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.gray[700] }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color={COLORS.gray[400]} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Recent Searches
                  </Text>
                </View>
                <TouchableOpacity onPress={clearAllHistory}>
                  <Text style={{ fontSize: 11, color: COLORS.primary[600], fontWeight: '600' }}>Clear all</Text>
                </TouchableOpacity>
              </View>

              {recentSearches.map((term) => (
                <View
                  key={term}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 11,
                    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
                    gap: 12,
                  }}
                >
                  <Clock size={14} color={COLORS.gray[300]} />
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => handleHistoryPress(term)}>
                    <Text style={{ fontSize: 13, color: COLORS.gray[800] }}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeFromHistory(term)} style={{ padding: 4 }}>
                    <X size={13} color={COLORS.gray[300]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Popular searches */}
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <TrendingUp size={13} color={COLORS.primary[800]} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Popular Searches
              </Text>
            </View>
            {(popularSearches.length > 0 ? popularSearches : POPULAR_SEARCHES_FALLBACK.map(q => ({ query: q, search_count: 0 }))).map((item) => (
              <TouchableOpacity
                key={item.query}
                onPress={() => handleHistoryPress(item.query)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 11,
                  borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
                  gap: 12,
                }}
              >
                <TrendingUp size={14} color={COLORS.primary[300]} />
                <Text style={{ fontSize: 13, color: COLORS.gray[700], flex: 1 }}>{item.query}</Text>
                {item.search_count > 1 && (
                  <Text style={{ fontSize: 10, color: COLORS.gray[400], fontWeight: '600' }}>
                    {item.search_count >= 1000
                      ? `${(item.search_count / 1000).toFixed(1)}k`
                      : item.search_count} searches
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : loading ? (
        /* ── Loading skeleton ─────────────────────────────────────────────────── */
        <View style={{ marginTop: 4 }}>
          {/* Still show category chips while loading */}
          {categories.length > 0 && (
            <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6 }}>
                <TouchableOpacity
                  onPress={() => handleCategorySelect('')}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: !selectedCategory ? COLORS.primary[800] : '#f3f4f6' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedCategory ? '#fff' : COLORS.gray[600] }}>All</Text>
                </TouchableOpacity>
                {categories.map((cat: any) => (
                  <TouchableOpacity key={cat.id} onPress={() => handleCategorySelect(cat.slug)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: selectedCategory === cat.slug ? COLORS.primary[800] : '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat.slug] || '📦'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedCategory === cat.slug ? '#fff' : COLORS.gray[600] }}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <ProductListSkeleton count={6} />
        </View>
      ) : results.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────────────── */
        <View>
          <ListHeader />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 }}>
            <SearchIcon size={48} color={COLORS.gray[300]} />
            <Text style={{ color: COLORS.gray[600], fontSize: 15, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
              No results for "{query}"
            </Text>
            <Text style={{ color: COLORS.gray[400], fontSize: 12, marginTop: 6, textAlign: 'center' }}>
              Try different keywords{selectedCategory ? ' or remove the category filter' : ''}
            </Text>
            {selectedCategory && (
              <TouchableOpacity
                onPress={() => handleCategorySelect('')}
                style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Show All Categories</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        /* ── Results list ─────────────────────────────────────────────────────── */
        <FlatList
          data={results}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductCard product={item} />}
          ListHeaderComponent={<ListHeader />}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 20 }}
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
  );
}
