import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { wishlistAPI } from '../../api/services';
import ProductCard from '../../components/marketplace/ProductCard';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonList } from '../../components/common/Skeleton';

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wishlistAPI.get().then(res => {
      setItems(res.data.wishlist);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList count={4} />;

  return (
    <div className="pb-20 md:pb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Wishlist ({items.length})</h1>

      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Your wishlist is empty" description="Save products you love by clicking the heart icon." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <ProductCard key={item.id} product={{ ...item, id: item.product_id, name: item.product_name, primary_image: item.product_image }} />
          ))}
        </div>
      )}
    </div>
  );
}
