import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, TrendingUp, Star, MapPin, Utensils, Shirt, Smartphone, Home as HomeIcon, Leaf, Package, BookOpen, Watch, Wrench, Hand } from 'lucide-react';
import { productsAPI, categoriesAPI, recommendationsAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import { SkeletonList } from '../../components/common/Skeleton';

const FALLBACK_CATEGORIES = [
  { id: 1, name: 'Food & Beverages', slug: 'food-beverages', product_count: 0, icon: 'utensils' },
  { id: 2, name: 'Clothing', slug: 'clothing', product_count: 0, icon: 'shirt' },
  { id: 3, name: 'Electronics', slug: 'electronics', product_count: 0, icon: 'smartphone' },
  { id: 4, name: 'Home & Living', slug: 'home-living', product_count: 0, icon: 'home' },
  { id: 5, name: 'Beauty & Care', slug: 'beauty-personal-care', product_count: 0, icon: 'sparkles' },
  { id: 6, name: 'Agriculture', slug: 'agriculture', product_count: 0, icon: 'leaf' },
  { id: 7, name: 'Local Products', slug: 'local-products', product_count: 0, icon: 'map-pin' },
  { id: 8, name: 'Handmade', slug: 'handmade-products', product_count: 0, icon: 'hand' },
  { id: 9, name: 'School Supplies', slug: 'school-supplies', product_count: 0, icon: 'book' },
  { id: 10, name: 'Accessories', slug: 'accessories', product_count: 0, icon: 'watch' },
];

const ICON_MAP = {
  utensils: Utensils, shirt: Shirt, smartphone: Smartphone, home: HomeIcon,
  sparkles: Sparkles, leaf: Leaf, 'map-pin': MapPin, hand: Hand,
  book: BookOpen, watch: Watch, wrench: Wrench, package: Package,
};

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredRes, newRes, popularRes, recsRes, catsRes] = await Promise.all([
          productsAPI.list({ sort: 'rating', limit: 8 }),
          productsAPI.list({ sort: 'newest', limit: 8 }),
          productsAPI.list({ sort: 'popular', limit: 8 }),
          recommendationsAPI.get({ type: 'for_you', limit: 8 }).catch(() => ({ data: { recommendations: [] } })),
          categoriesAPI.list(),
        ]);
        setFeatured(featuredRes.data.products || []);
        setNewProducts(newRes.data.products || []);
        setPopular(popularRes.data.products || []);
        setRecommendations(recsRes.data.recommendations || []);
        if (catsRes.data.categories?.length > 0) {
          setCategories(catsRes.data.categories);
        }
        setApiAvailable(true);
      } catch {
        setApiAvailable(false);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Only start polling if API is available — never causes page refresh
  useEffect(() => {
    if (!apiAvailable) return;
    const id = setInterval(async () => {
      try {
        const [popularRes, recsRes] = await Promise.all([
          productsAPI.list({ sort: 'popular', limit: 8 }),
          recommendationsAPI.get({ type: 'for_you', limit: 8 }).catch(() => ({ data: { recommendations: [] } })),
        ]);
        // Only update state with new data — React batches these, no flicker
        setPopular(popularRes.data.products || []);
        setRecommendations(recsRes.data.recommendations || []);
      } catch {
        clearInterval(id);
      }
    }, 3000);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [apiAvailable]); // Dependency only on apiAvailable, not on fetched data

  return (
    <div className="pb-20 md:pb-0">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-400/10 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-300/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16 lg:py-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-accent-300 px-3 py-1.5 rounded-full text-xs font-medium mb-4 border border-white/10">
              <MapPin size={12} /> Bago City, Negros Occidental
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              Your Local Community <span className="text-accent-400">Marketplace</span>
            </h1>
            <p className="text-white/70 text-sm sm:text-base mb-8 leading-relaxed">
              Discover products from local sellers in Bago City. Fresh produce, handmade crafts, electronics, and more — delivered right to your doorstep.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/marketplace" className="inline-flex items-center gap-2 bg-accent-400 hover:bg-accent-300 text-primary-900 px-6 py-3 rounded-lg font-bold text-sm transition-colors shadow-lg">
                Browse Marketplace <ArrowRight size={16} />
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium text-sm transition-colors border border-white/20">
                Start Selling
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        {/* Categories */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">CATEGORIES</h2>
            <Link to="/marketplace" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
            {categories.slice(0, 10).map(cat => {
              const IconComponent = ICON_MAP[cat.icon] || Package;
              return (
                <Link key={cat.id} to={`/marketplace?category=${cat.slug}`}
                  className="flex flex-col items-center p-3 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all group text-center">
                  <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-primary-100 transition-colors">
                    <IconComponent size={20} className="text-primary-800" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-700 leading-tight">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <section className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-accent-200 rounded-lg flex items-center justify-center">
                  <Sparkles size={14} className="text-primary-900" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Recommended For You</h2>
                  <p className="text-[11px] text-gray-500">Based on your activity</p>
                </div>
              </div>
              <Link to="/recommendations" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
                See All <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {recommendations.map(product => (
                <ProductCard key={product.id} product={product} badge="AI Pick" />
              ))}
            </div>
          </section>
        )}

        {/* Featured Products */}
        <section className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-accent-400 fill-accent-400" />
              <h2 className="text-lg font-bold text-gray-900">Featured Products</h2>
            </div>
            <Link to="/marketplace?sort=rating" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? <SkeletonList count={5} /> : featured.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {featured.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <Package size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Products will appear here once sellers list items</p>
              <p className="text-gray-400 text-xs mt-1">Be the first seller to get featured!</p>
            </div>
          )}
        </section>

        {/* Trending */}
        <section className="py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-800" />
              <h2 className="text-lg font-bold text-gray-900">Trending Now</h2>
            </div>
            <Link to="/marketplace?sort=popular" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? <SkeletonList count={5} /> : popular.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {popular.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <TrendingUp size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Trending products will show as the marketplace grows</p>
            </div>
          )}
        </section>

        {/* New Arrivals */}
        <section className="py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">New Arrivals</h2>
            <Link to="/marketplace?sort=newest" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? <SkeletonList count={5} /> : newProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {newProducts.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <Package size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">New products will appear here</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
