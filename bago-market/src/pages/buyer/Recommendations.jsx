import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, Package } from 'lucide-react';
import { recommendationsAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import { SkeletonList } from '../../components/common/Skeleton';
import { useAuth } from '../../context/AuthContext';

export default function Recommendations() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [source,   setSource]   = useState('sql');
  const [loading,  setLoading]  = useState(true);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await recommendationsAPI.get({ type: 'for_you', limit: 40 });
      setProducts(res.data?.recommendations || []);
      setSource(res.data?.source || 'sql');
    } catch {
      setProducts([]);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Silent refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const isAI = source === 'ai';

  return (
    <div className="pb-20 md:pb-8">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-primary-900 to-primary-700 px-4 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* AI badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-accent-400 px-2.5 py-1 rounded-lg">
                  <Sparkles size={11} className="text-primary-900" />
                  <span className="text-primary-900 text-[10px] font-black tracking-widest uppercase">
                    OpenRouter AI
                  </span>
                </div>
                {isAI && (
                  <span className="text-[10px] font-semibold text-white/70 bg-white/10 px-2 py-0.5 rounded">
                    Live
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold text-white">For You</h1>
              <p className="text-white/60 text-sm mt-1">
                {user
                  ? `${products.length} personalised picks · powered by AI`
                  : 'Discover the most popular products in Bago City'}
              </p>
            </div>

            <button
              onClick={() => fetchData()}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors border border-white/15 shrink-0"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Product grid ── */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {loading ? (
          <SkeletonList count={10} />
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              Browse some products first!
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              The more you explore, the more accurate your recommendations become.
            </p>
          </div>
        ) : (
          <>
            {/* Count row */}
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={16} className="text-accent-500" />
              <span className="text-sm font-semibold text-gray-700">
                {products.length} picks just for you
              </span>
              {isAI && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary-800 to-accent-500 text-white text-[10px] font-bold shadow-sm">
                  <Sparkles size={8} /> OpenRouter AI
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map(p => (
                <ProductCard key={p.id} product={p} badge="AI Pick" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
