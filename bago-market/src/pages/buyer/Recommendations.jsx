import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Eye, MapPin } from 'lucide-react';
import { recommendationsAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import { SkeletonList } from '../../components/common/Skeleton';

export default function Recommendations() {
  const [forYou, setForYou] = useState([]);
  const [becauseViewed, setBecauseViewed] = useState([]);
  const [trending, setTrending] = useState([]);
  const [nearYou, setNearYou] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = async () => {
    try {
      const [fyRes, bvRes, trendRes, nearRes] = await Promise.all([
        recommendationsAPI.get({ type: 'for_you', limit: 8 }),
        recommendationsAPI.get({ type: 'because_viewed', limit: 8 }),
        recommendationsAPI.get({ type: 'general', limit: 8 }),
        recommendationsAPI.get({ type: 'trending_barangay', limit: 8 }),
      ]);
      setForYou(fyRes.data.recommendations);
      setBecauseViewed(bvRes.data.recommendations);
      setTrending(trendRes.data.recommendations);
      setNearYou(nearRes.data.recommendations);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecommendations(); }, []);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(fetchRecommendations, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <SkeletonList count={8} />;

  return (
    <div className="space-y-10 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Personalized For You</h1>
        <p className="text-gray-500 text-sm">Products recommended based on your activity</p>
      </div>

      {/* Recommended For You */}
      {forYou.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-accent-400" />
            <h2 className="text-lg font-bold text-gray-900">Recommended For You</h2>
            <span className="px-2 py-0.5 bg-accent-200 text-primary-900 text-[10px] font-bold rounded-full">AI Pick</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {forYou.map(p => <ProductCard key={p.id} product={p} badge="AI Pick" />)}
          </div>
        </section>
      )}

      {/* Because You Viewed */}
      {becauseViewed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-primary-800" />
            <h2 className="text-lg font-bold text-gray-900">Because You Viewed</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {becauseViewed.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-primary-800" />
            <h2 className="text-lg font-bold text-gray-900">Trending Products</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trending.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Trending Near You */}
      {nearYou.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-primary-800" />
            <h2 className="text-lg font-bold text-gray-900">Trending in Your Barangay</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {nearYou.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {forYou.length === 0 && becauseViewed.length === 0 && trending.length === 0 && (
        <div className="text-center py-16">
          <Sparkles size={40} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700">Browse some products so we can improve your recommendations.</h3>
          <p className="text-gray-500 text-sm mt-1">The more you explore, the better our AI can suggest products for you.</p>
        </div>
      )}
    </div>
  );
}
