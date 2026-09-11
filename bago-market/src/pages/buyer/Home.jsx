import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, TrendingUp, Star, MapPin, Utensils, Shirt, Smartphone, Home as HomeIcon, Leaf, Package, BookOpen, Watch, Wrench, Hand, Download, Bike } from 'lucide-react';
import { productsAPI, categoriesAPI, recommendationsAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import { SkeletonList } from '../../components/common/Skeleton';
import { useSEO } from '../../hooks/useSEO';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/images/logo.png';

const FALLBACK_CATEGORIES = [
  { id: 1,  name: 'Food & Beverages', slug: 'food-beverages',       product_count: 0, icon: 'utensils'   },
  { id: 2,  name: 'Clothing',         slug: 'clothing',             product_count: 0, icon: 'shirt'      },
  { id: 3,  name: 'Electronics',      slug: 'electronics',          product_count: 0, icon: 'smartphone' },
  { id: 4,  name: 'Home & Living',    slug: 'home-living',          product_count: 0, icon: 'home'       },
  { id: 5,  name: 'Beauty & Care',    slug: 'beauty-personal-care', product_count: 0, icon: 'sparkles'   },
  { id: 6,  name: 'Agriculture',      slug: 'agriculture',          product_count: 0, icon: 'leaf'       },
  { id: 7,  name: 'Local Products',   slug: 'local-products',       product_count: 0, icon: 'map-pin'    },
  { id: 8,  name: 'Handmade',         slug: 'handmade-products',    product_count: 0, icon: 'hand'       },
  { id: 9,  name: 'School Supplies',  slug: 'school-supplies',      product_count: 0, icon: 'book'       },
  { id: 10, name: 'Accessories',      slug: 'accessories',          product_count: 0, icon: 'watch'      },
];

const ICON_MAP = {
  utensils: Utensils, shirt: Shirt, smartphone: Smartphone, home: HomeIcon,
  sparkles: Sparkles, leaf: Leaf, 'map-pin': MapPin, hand: Hand,
  book: BookOpen, watch: Watch, wrench: Wrench, package: Package,
};

/* Thin horizontal divider used between sections */
function SectionDivider() {
  return <div className="border-t border-gray-100 mx-0" />;
}

export default function Home() {
  const { user } = useAuth();
  const [featured, setFeatured]           = useState([]);
  const [newProducts, setNewProducts]     = useState([]);
  const [popular, setPopular]             = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recSource, setRecSource]         = useState('sql');
  const [categories, setCategories]       = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading]             = useState(true);
  const [apiAvailable, setApiAvailable]   = useState(false);
  const [downloadOpen, setDownloadOpen]   = useState(false);
  const intervalRef = useRef(null);

  useSEO({
    title: 'Home — Shop Local Products',
    description: 'Your community marketplace in Bago City. Discover fresh produce, handmade crafts, electronics and more from trusted local sellers.',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredRes, newRes, popularRes, catsRes] = await Promise.all([
          productsAPI.list({ sort: 'rating',  limit: 8 }),
          productsAPI.list({ sort: 'newest',  limit: 8 }),
          productsAPI.list({ sort: 'popular', limit: 8 }),
          categoriesAPI.list(),
        ]);
        setFeatured(featuredRes.data.products || []);
        setNewProducts(newRes.data.products   || []);
        setPopular(popularRes.data.products   || []);
        if (catsRes.data.categories?.length > 0) setCategories(catsRes.data.categories);

        // Only fetch recommendations for logged-in users
        if (user) {
          const recsRes = await recommendationsAPI.get({ type: 'for_you', limit: 8 })
            .catch(() => ({ data: { recommendations: [], source: 'sql' } }));
          setRecommendations(recsRes.data.recommendations || []);
          setRecSource(recsRes.data.source || 'sql');
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

  useEffect(() => {
    if (!apiAvailable) return;
    const id = setInterval(async () => {
      try {
        const popularRes = await productsAPI.list({ sort: 'popular', limit: 8 });
        setPopular(popularRes.data.products || []);

        // Only poll recommendations for logged-in users
        if (user) {
          const recsRes = await recommendationsAPI.get({ type: 'for_you', limit: 8 })
            .catch(() => ({ data: { recommendations: [], source: 'sql' } }));
          setRecommendations(recsRes.data.recommendations || []);
          setRecSource(recsRes.data.source || 'sql');
        }
      } catch {
        clearInterval(id);
      }
    }, 3000);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [apiAvailable, user]);

  return (
    <div className="pb-24 md:pb-0">

      {/* ── Hero Banner ── */}
      <section className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-700 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-400/10 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-300/10 rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            {/* Left: text content */}
            <div className="max-w-2xl flex-1">
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-accent-300 px-3 py-1.5 rounded-full text-xs font-medium mb-4 border border-white/10">
                <MapPin size={12} /> Bago City, Negros Occidental
              </div>
              {!user && (
                <p className="text-accent-300 font-semibold text-sm sm:text-base mb-2 tracking-wide">
                  Welcome to Bago Shop Express
                </p>
              )}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                Your Local Community{' '}
                <span className="text-accent-400">Marketplace</span>
              </h1>
              <p className="text-white/70 text-sm sm:text-base mb-8 leading-relaxed max-w-lg">
                Discover products from local sellers in Bago City. Fresh produce, handmade crafts, electronics, and more — delivered right to your doorstep.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2 bg-accent-400 hover:bg-accent-300 text-primary-900 px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg"
                >
                  Browse Marketplace <ArrowRight size={16} />
                </Link>
                {/* Download App — opens modal */}
                <button
                  type="button"
                  onClick={() => setDownloadOpen(true)}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors border border-white/20"
                >
                  <Download size={16} /> Download App
                </button>

                {/* Download Modal */}
                {downloadOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDownloadOpen(false)} />

                    {/* Modal */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">

                      {/* Header */}
                      <div className="bg-gradient-to-r from-primary-900 to-primary-700 px-6 py-5 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-lg font-bold">Download Our App</h2>
                            <p className="text-white/70 text-xs mt-0.5">Choose an app and your preferred download source</p>
                          </div>
                          <button
                            onClick={() => setDownloadOpen(false)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-lg leading-none"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* App Cards */}
                      <div className="p-5 space-y-4">

                        {/* Market Application */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-primary-50">
                            <div className="w-10 h-10 bg-primary-800 rounded-xl flex items-center justify-center shrink-0">
                              <Smartphone size={20} className="text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">Market Application</p>
                            </div>
                          </div>
                          <div className="flex gap-2 px-4 py-3 bg-white">
                            {/* Google Drive */}
                            <a
                              href="#"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors group"
                            >
                              {/* Google Drive logo SVG */}
                              <svg width="18" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                              </svg>
                              <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">Google Drive</span>
                            </a>
                            {/* MediaFire */}
                            <a
                              href="#"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors group"
                            >
                              {/* MediaFire flame logo SVG */}
                              <svg width="16" height="18" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M24 0C24 0 14 10 14 22C14 28 17 32 20 35C19 31 20 27 23 25C23 30 25 34 29 37C29 33 30 29 33 27C36 31 36 36 34 40C37 37 38 32 37 28C40 31 42 36 41 42C43 39 44 34 42 29C45 33 46 39 44 45C46 42 48 37 46 31C46 44 40 52 32 55C28 56 24 56 20 55C12 52 6 44 6 35C6 24 14 14 24 0Z" fill="#CC0000"/>
                                <path d="M24 12C24 12 18 20 18 28C18 33 21 37 24 39C22 35 23 31 26 29C26 33 28 37 32 39C31 35 32 31 35 29C37 32 37 36 35 40C38 37 38 32 36 28C38 31 40 36 38 42C40 38 40 33 38 28C38 38 34 44 28 46C25 47 22 46 20 45C15 42 12 37 12 31C12 22 18 15 24 12Z" fill="#FF4500"/>
                              </svg>
                              <span className="text-xs font-medium text-gray-600 group-hover:text-red-600">MediaFire</span>
                            </a>
                          </div>
                        </div>

                        {/* Rider Application */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-accent-50">
                            <div className="w-10 h-10 bg-primary-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                              <img src={logoImg} alt="Rider App" className="w-full h-full object-contain p-1" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">Rider Application</p>
                              <p className="text-xs text-gray-500">For delivery riders</p>
                            </div>
                          </div>
                          <div className="flex gap-2 px-4 py-3 bg-white">
                            {/* Google Drive */}
                            <a
                              href="#"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors group"
                            >
                              <svg width="18" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                              </svg>
                              <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">Google Drive</span>
                            </a>
                            {/* MediaFire */}
                            <a
                              href="#"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors group"
                            >
                              <svg width="16" height="18" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M24 0C24 0 14 10 14 22C14 28 17 32 20 35C19 31 20 27 23 25C23 30 25 34 29 37C29 33 30 29 33 27C36 31 36 36 34 40C37 37 38 32 37 28C40 31 42 36 41 42C43 39 44 34 42 29C45 33 46 39 44 45C46 42 48 37 46 31C46 44 40 52 32 55C28 56 24 56 20 55C12 52 6 44 6 35C6 24 14 14 24 0Z" fill="#CC0000"/>
                                <path d="M24 12C24 12 18 20 18 28C18 33 21 37 24 39C22 35 23 31 26 29C26 33 28 37 32 39C31 35 32 31 35 29C37 32 37 36 35 40C38 37 38 32 36 28C38 31 40 36 38 42C40 38 40 33 38 28C38 38 34 44 28 46C25 47 22 46 20 45C15 42 12 37 12 31C12 22 18 15 24 12Z" fill="#FF4500"/>
                              </svg>
                              <span className="text-xs font-medium text-gray-600 group-hover:text-red-600">MediaFire</span>
                            </a>
                          </div>
                        </div>

                      </div>

                      {/* Footer note */}
                      <div className="px-5 pb-5 text-center">
                        <p className="text-[11px] text-gray-400">APK files — install on any Android device</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: big logo — pushed to the far right edge */}
            <div className="hidden lg:flex flex-shrink-0 items-center justify-end ml-auto">
              <img
                src={logoImg}
                alt="Bago Shop Express"
                className="w-85 h-85 object-contain drop-shadow-2xl opacity-100"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Page body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* ── Categories ── */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Categories</h2>
            <Link to="/marketplace" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {/* 
            5 columns on md, 10 on xl — removed the jarring md→lg jump.
            On mobile: 5 columns of tiny cards works well; label wraps but stays readable.
          */}
          <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10 gap-2 sm:gap-3">
            {categories.slice(0, 10).map(cat => {
              const IconComponent = ICON_MAP[cat.icon] || Package;
              return (
                <Link
                  key={cat.id}
                  to={`/marketplace?category=${cat.slug}`}
                  className="flex flex-col items-center p-2 sm:p-3 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all group text-center"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-50 rounded-full flex items-center justify-center mb-1.5 sm:mb-2 group-hover:bg-primary-100 transition-colors shrink-0">
                    <IconComponent size={18} className="text-primary-800" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-medium text-gray-700 leading-tight line-clamp-2">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <SectionDivider />

        {/* ── AI Recommendations — only for logged-in users ── */}
        {user && recommendations.length > 0 && (
          <>
            <section className="py-8">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-accent-200 rounded-lg flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-primary-900" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">Recommended For You</h2>
                    <p className="text-[11px] text-gray-500">Based on your activity</p>
                  </div>
                  {(recSource === 'ai' || recSource === 'cache') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary-800 to-accent-500 text-white text-[10px] font-bold shadow-sm">
                      <Sparkles size={8} /> AI
                    </span>
                  )}
                </div>
                <Link to="/recommendations" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1 shrink-0">
                  See All <ArrowRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {recommendations.map(product => (
                  <ProductCard key={product.id} product={product} badge="AI Pick" />
                ))}
              </div>
            </section>
            <SectionDivider />
          </>
        )}

        {/* ── Featured Products ── */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-accent-400 fill-accent-400 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900">Featured Products</h2>
            </div>
            <Link to="/marketplace?sort=rating" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1 shrink-0">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <SkeletonList count={5} />
          ) : featured.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {featured.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <Package size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Products will appear here once sellers list items</p>
              <p className="text-gray-400 text-xs mt-1">Be the first seller to get featured!</p>
            </div>
          )}
        </section>

        <SectionDivider />

        {/* ── Trending Now ── */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-800 shrink-0" />
              <h2 className="text-lg font-bold text-gray-900">Trending Now</h2>
            </div>
            <Link to="/marketplace?sort=popular" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1 shrink-0">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <SkeletonList count={5} />
          ) : popular.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {popular.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <TrendingUp size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Trending products will show as the marketplace grows</p>
            </div>
          )}
        </section>

        <SectionDivider />

        {/* ── New Arrivals ── */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">New Arrivals</h2>
            <Link to="/marketplace?sort=newest" className="text-sm text-primary-800 hover:underline font-medium flex items-center gap-1 shrink-0">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <SkeletonList count={5} />
          ) : newProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {newProducts.map(product => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
              <Package size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">New products will appear here</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
