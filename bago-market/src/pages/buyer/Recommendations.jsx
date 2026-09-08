import { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, Eye, MapPin, RefreshCw } from 'lucide-react';
import { recommendationsAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import { SkeletonList } from '../../components/common/Skeleton';
import { useAuth } from '../../context/AuthContext';

const TYPES = [
  { key: 'for_you',          label: 'For You',          icon: Sparkles,    badge: 'AI Pick',   color: 'text-accent-500' },
  { key: 'because_viewed',   label: 'Because You Viewed', icon: Eye,       badge: null,        color: 'text-primary-800' },
  { key: 'trending_barangay',label: 'Near Your Area',   icon: MapPin,      badge: 'Local',     color: 'text-green-600' },
  { key: 'general',          label: 'Trending Now',     icon: TrendingUp,  badge: 'Popular',   color: 'text-primary-800' },
];

export default function Recommendations() {
  const { user } = useAuth();
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('for_you');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const results = await Promise.all(
        TYPES.map(t => recommendationsAPI.get({ type: t.key, limit: 12 })
          .catch(() => ({ recommendations: [] }))
        )
      );
      const next = {};
      TYPES.forEach((t, i) => {
        next[t.key] = results[i].recommendations || results[i].data?.recommendations || [];
      });
      setData(next);
      setLastRefresh(Date.now());
    } catch {}
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => fetchAll(true), 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const current = TYPES.find(t => t.key === activeTab);
  const products = data[activeTab] || [];
  const total    = TYPES.reduce((sum, t) => sum + (data[t.key]?.length || 0), 0);

  return (
    <div className="pb-20 md:pb-8">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-primary-900 to-primary-700 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-accent-400/20 rounded-lg flex items-center justify-center">
                  <Sparkles size={16} className="text-accent-400" />
                </div>
                <span className="text-accent-400 text-xs font-bold uppercase tracking-wider">AI Recommendations</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Personalized For You</h1>
              <p className="text-white/60 text-sm mt-1">
                {user
                  ? `Based on your browsing history · ${total} products found`
                  : 'Discover the most popular products in Bago City'
                }
              </p>
            </div>
            <button
              onClick={() => fetchAll()}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors border border-white/15"
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
            {TYPES.map(t => {
              const count = data[t.key]?.length || 0;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    active
                      ? 'bg-white text-primary-900 shadow-md'
                      : 'bg-white/15 text-white/80 hover:bg-white/25 border border-white/20'
                  }`}
                >
                  <t.icon size={12} />
                  {t.label}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-100 text-primary-800' : 'bg-white/20'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        {loading ? (
          <SkeletonList count={8} />
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {current && <current.icon size={28} className="text-gray-300" />}
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              {activeTab === 'for_you'
                ? 'Browse some products first!'
                : activeTab === 'because_viewed'
                ? 'View some products to get suggestions'
                : activeTab === 'trending_barangay'
                ? 'No local data yet — set your delivery address to see local trends'
                : 'Nothing trending yet'}
            </h3>
            <p className="text-sm text-gray-500">
              {activeTab === 'for_you'
                ? 'The more you explore, the more accurate your recommendations become.'
                : 'Start exploring the marketplace and come back!'}
            </p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="flex items-center gap-2 mb-5">
              {current && <current.icon size={18} className={current.color} />}
              <h2 className="text-lg font-bold text-gray-900">{current?.label}</h2>
              {current?.badge && (
                <span className="text-[10px] font-bold bg-accent-200 text-primary-900 px-2 py-0.5 rounded-full">
                  {current.badge}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {products.length} products
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map(p => (
                <ProductCard key={p.id} product={p} badge={current?.badge} />
              ))}
            </div>

            {/* Cross-section previews */}
            {TYPES.filter(t => t.key !== activeTab && (data[t.key]?.length || 0) > 0).map(t => (
              <div key={t.key} className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <t.icon size={16} className={t.color} />
                    <h3 className="text-base font-bold text-gray-900">{t.label}</h3>
                    {t.badge && (
                      <span className="text-[10px] font-bold bg-accent-100 text-primary-900 px-1.5 py-0.5 rounded-full">{t.badge}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab(t.key)}
                    className="text-xs text-primary-800 font-semibold hover:underline"
                  >
                    See all {data[t.key].length} →
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {(data[t.key] || []).slice(0, 5).map(p => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
