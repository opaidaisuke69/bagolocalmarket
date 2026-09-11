import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronDown, LayoutGrid, List, Package, TrendingUp, Clock, Trash2 } from 'lucide-react';
import { productsAPI, categoriesAPI, searchAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import { SkeletonList } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { useSEO } from '../../hooks/useSEO';
import { SORT_OPTIONS, BARANGAYS } from '../../constants';

const PRICE_RANGES = [
  { label: 'Any Price', min: '', max: '' },
  { label: 'Under ₱100', min: '', max: '100' },
  { label: '₱100 – ₱500', min: '100', max: '500' },
  { label: '₱500 – ₱1,000', min: '500', max: '1000' },
  { label: '₱1,000 – ₱5,000', min: '1000', max: '5000' },
  { label: 'Over ₱5,000', min: '5000', max: '' },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="skeleton" style={{ aspectRatio: '1/1' }} />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-5 w-1/2 rounded mt-2" />
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [popularSearches, setPopularSearches] = useState([]);
  const searchRef = useRef(null);
  const lastRef = useRef(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    sort: searchParams.get('sort') || 'newest',
    barangay: '',
    min_price: '',
    max_price: '',
    rating: '',
  });

  const debouncedSearch = useDebounce(search, 500);

  // Dynamic SEO based on current search/category state
  const activeCategory = categories.find(c => c.slug === filters.category);
  useSEO({
    title: debouncedSearch
      ? `"${debouncedSearch}" — Search Results`
      : activeCategory
      ? `${activeCategory.name} Products`
      : 'Marketplace',
    description: debouncedSearch
      ? `Find "${debouncedSearch}" products from local Bago City sellers. ${total} items found.`
      : activeCategory
      ? `Browse ${activeCategory.name} products from local Bago City sellers.`
      : 'Discover local products from Bago City, Negros Occidental. Shop fresh produce, handmade crafts, electronics and more.',
    url: `${window.location.origin}/marketplace${window.location.search}`,
  });

  useEffect(() => {
    categoriesAPI.list().then(r => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  // Load recent search history
  useEffect(() => {
    searchAPI.history()
      .then(r => setRecentSearches(r.data.history || []))
      .catch(() => {});
    // Popular searches — no auth needed
    searchAPI.popular(8)
      .then(r => setPopularSearches(r.data.popular || []))
      .catch(() => {});
  }, []);

  // Fetch autocomplete suggestions via dedicated search endpoint
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSuggestions([]);
      return;
    }
    searchAPI.search({ q: debouncedSearch, category: filters.category, limit: 5 })
      .then(r => setSuggestions(r.data.suggestions || []))
      .catch(() => {});
  }, [debouncedSearch, filters.category]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchProducts = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await productsAPI.list({
        page: pageNum, limit: 20,
        search: debouncedSearch,
        category: filters.category,
        sort: filters.sort,
        barangay: filters.barangay,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
        rating: filters.rating || undefined,
      });
      const data = res.data.products || [];
      setProducts(prev => append ? [...prev, ...data] : data);
      setTotal(res.data.total || 0);
      setHasMore(pageNum < (res.data.total_pages || 1));
    } catch {
      if (!append) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, filters]);

  // Silent background poll — never shows loading spinner, never resets list
  const silentPoll = useCallback(async () => {
    try {
      const res = await productsAPI.list({
        page: 1, limit: 20,
        search: debouncedSearch,
        category: filters.category,
        sort: filters.sort,
        barangay: filters.barangay,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
        rating: filters.rating || undefined,
      });
      const fresh = res.data.products || [];
      setTotal(res.data.total || 0);
      // Only update the first page entries silently — don't disturb scroll position
      setProducts(prev => {
        if (prev.length <= 20) return fresh;
        return [...fresh, ...prev.slice(20)];
      });
    } catch {
      // silent — network hiccup, skip
    }
  }, [debouncedSearch, filters]);

  // Reset and fetch when filters/search change
  useEffect(() => {
    setPage(1);
    fetchProducts(1, false);
  }, [fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const next = page + 1;
        setPage(next);
        fetchProducts(next, true);
      }
    }, { rootMargin: '200px' });
    const el = lastRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchProducts]);

  // Silent real-time refresh — no loading state, no scroll reset
  useEffect(() => {
    if (!products.length) return;
    const id = setInterval(silentPoll, 3000);
    return () => clearInterval(id);
  }, [silentPoll, products.length]);

  const setFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value); else p.delete(key);
    setSearchParams(p);
  };

  const clearAll = () => {
    setFilters({ category: '', sort: 'newest', barangay: '', min_price: '', max_price: '', rating: '' });
    setSearch('');
    setSearchParams({});
  };

  const applySearch = (term) => {
    setSearch(term);
    setShowSuggestions(false);
    const p = new URLSearchParams(searchParams);
    if (term) p.set('search', term); else p.delete('search');
    setSearchParams(p);
  };

  const removeRecentSearch = async (term) => {
    try {
      await searchAPI.deleteItem(term);
      setRecentSearches(prev => prev.filter(t => t !== term));
    } catch {}
  };

  const clearAllRecentSearches = async () => {
    try {
      await searchAPI.clearAll();
      setRecentSearches([]);
    } catch {}
  };

  const hasActive = Object.entries(filters).some(([k, v]) => v && !(k === 'sort' && v === 'newest')) || search;
  const activeCount = [filters.category, filters.barangay, filters.min_price || filters.max_price, filters.rating].filter(Boolean).length;

  return (
    <div className="bg-gray-50 min-h-screen pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* ── Header ── */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Marketplace</h1>
          <p className="text-sm text-gray-500">Discover local products from Bago City sellers</p>
        </div>

        {/* ── Search + Filter bar ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex gap-2 sm:gap-3">
            {/* Search input with suggestions */}
            <div className="flex-1 relative" ref={searchRef}>
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); applySearch(search); }
                  if (e.key === 'Escape') setShowSuggestions(false);
                }}
                placeholder="Search products, brands, categories..."
                autoComplete="off"
                aria-label="Search marketplace"
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 focus:bg-white focus:border-transparent outline-none transition-all placeholder-gray-400"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setSuggestions([]); setShowSuggestions(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}

              {/* ── Suggestions Dropdown ── */}
              {showSuggestions && (suggestions.length > 0 || (!search && (recentSearches.length > 0 || popularSearches.length > 0))) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50">

                  {/* Recent searches — shown when input is empty */}
                  {!search && recentSearches.length > 0 && (
                    <div className="py-2">
                      <div className="flex items-center justify-between px-4 py-1.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock size={11} /> Recent
                        </span>
                        <button
                          onClick={clearAllRecentSearches}
                          className="text-[11px] text-red-400 hover:text-red-600 font-medium transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                      {recentSearches.slice(0, 5).map((term) => (
                        <div key={term} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 group cursor-pointer">
                          <Clock size={13} className="text-gray-300 shrink-0" />
                          <button
                            onClick={() => applySearch(term)}
                            className="flex-1 text-left text-sm text-gray-700 truncate hover:text-primary-800 transition-colors"
                          >
                            {term}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeRecentSearch(term); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-400 rounded"
                            aria-label={`Remove "${term}" from recent searches`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Popular searches — shown when input is empty */}
                  {!search && popularSearches.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp size={11} className="text-primary-600" /> Trending
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-0">
                        {popularSearches.slice(0, 6).map((item) => (
                          <button
                            key={item.query}
                            onClick={() => applySearch(item.query)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-left group"
                          >
                            <TrendingUp size={12} className="text-primary-300 shrink-0 group-hover:text-primary-600 transition-colors" />
                            <span className="text-sm text-gray-700 truncate">{item.query}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category suggestions — shown while typing */}
                  {search && suggestions.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1.5">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Categories</span>
                      </div>
                      {suggestions.map((cat) => (
                        <button
                          key={cat.slug}
                          onClick={() => { setFilter('category', cat.slug); setShowSuggestions(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 hover:text-primary-800 text-left transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-primary-50 group-hover:bg-primary-100 flex items-center justify-center shrink-0 transition-colors">
                            <Search size={13} className="text-primary-500" />
                          </div>
                          <span className="text-sm text-gray-800 flex-1 font-medium">{cat.name}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                            {cat.product_count} items
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Bottom action: search for typed term */}
                  {search && (
                    <div className="py-2 px-4">
                      <button
                        onClick={() => applySearch(search)}
                        className="w-full flex items-center gap-2 py-2 text-sm font-semibold text-primary-800 hover:text-primary-900 transition-colors"
                      >
                        <Search size={14} />
                        Search for &ldquo;{search}&rdquo;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filter toggle button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all shrink-0 ${
                showFilters
                  ? 'bg-primary-800 text-white border-primary-800 shadow-sm'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal size={15} />
              <span className="hidden sm:inline">Filters</span>
              {activeCount > 0 && (
                <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0 ${
                  showFilters ? 'bg-white text-primary-800' : 'bg-primary-800 text-white'
                }`}>
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Filter panel ── */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Category</label>
                  <select value={filters.category} onChange={e => setFilter('category', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Sort By</label>
                  <select value={filters.sort} onChange={e => setFilter('sort', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Barangay */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Barangay</label>
                  <select value={filters.barangay} onChange={e => setFilter('barangay', e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                    <option value="">All Barangays</option>
                    {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* Price range */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Price Range</label>
                  <select
                    value={`${filters.min_price}-${filters.max_price}`}
                    onChange={e => {
                      const [min, max] = e.target.value.split('-');
                      setFilters(prev => ({ ...prev, min_price: min, max_price: max }));
                    }}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-800 outline-none">
                    {PRICE_RANGES.map(r => <option key={r.label} value={`${r.min}-${r.max}`}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Rating filter */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Minimum Rating</label>
                <div className="flex gap-2">
                  {['', '4', '3', '2'].map(r => (
                    <button key={r} onClick={() => setFilter('rating', r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${filters.rating === r ? 'bg-primary-800 text-white border-primary-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {r ? `${r}+ ★` : 'Any'}
                    </button>
                  ))}
                </div>
              </div>

              {hasActive && (
                <button onClick={clearAll} className="mt-3 text-xs text-red-500 hover:text-red-600 font-medium hover:underline flex items-center gap-1">
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Category pills ── */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
            <button
              onClick={() => setFilter('category', '')}
              className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 transition-all ${!filters.category ? 'bg-primary-800 text-white border-primary-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilter('category', cat.slug)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 transition-all ${filters.category === cat.slug ? 'bg-primary-800 text-white border-primary-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Results header ── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading ? (
              <span className="skeleton h-4 w-28 rounded inline-block" />
            ) : (
              total > 0 ? <><span className="font-semibold text-gray-900">{total.toLocaleString()}</span> products found</> : ''
            )}
          </p>
          {hasActive && (
            <button onClick={clearAll} className="text-xs text-primary-800 hover:underline font-medium flex items-center gap-1">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>

        {/* ── Product grid ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20">
            <EmptyState
              icon={Package}
              title="No products found"
              description={hasActive ? "Try adjusting your filters or search terms." : "No products available yet. Check back later!"}
              action={hasActive && (
                <button onClick={clearAll} className="px-5 py-2.5 bg-primary-800 text-white rounded-xl text-sm font-semibold hover:bg-primary-900 transition-colors">
                  Clear Filters
                </button>
              )}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map((product, index) => (
                <div key={product.id} ref={index === products.length - 1 ? lastRef : null}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>

            {/* Loading more skeleton */}
            {loadingMore && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {/* End of list */}
            {!hasMore && products.length > 0 && (
              <div className="text-center py-10">
                <div className="inline-flex items-center gap-2 text-gray-400 text-sm bg-white border border-gray-200 px-5 py-2.5 rounded-full">
                  <TrendingUp size={14} />
                  You've seen all {total.toLocaleString()} products
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
