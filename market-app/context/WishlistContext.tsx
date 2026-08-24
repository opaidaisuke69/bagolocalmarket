import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { wishlistAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface WishlistItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  price: number;
  stock: number;
  is_available: number | string;
  category_name: string;
  store_name: string;
  seller_name: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  productIds: Set<number>;
  loading: boolean;
  fetchWishlist: () => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  isInWishlist: (productId: number) => boolean;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [productIds, setProductIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const fetchWishlist = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await wishlistAPI.get();
      const wishlist = data.wishlist || data.items || data.products || [];
      setItems(wishlist);
      setProductIds(new Set(wishlist.map((item: any) => Number(item.product_id))));
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (user) fetchWishlist();
    else { setItems([]); setProductIds(new Set()); }
  }, [user, fetchWishlist]);

  const toggleWishlist = async (productId: number) => {
    if (!user) return;

    const wasInWishlist = productIds.has(productId);

    // Optimistic update
    if (wasInWishlist) {
      setProductIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
      setItems(prev => prev.filter(item => Number(item.product_id) !== productId));
    } else {
      setProductIds(prev => new Set(prev).add(productId));
    }

    try {
      const res = await wishlistAPI.toggle({ product_id: productId });
      if (res.action === 'added') {
        showToast('Added to wishlist', 'success');
        // Refresh to get full product data
        fetchWishlist();
      } else {
        showToast('Removed from wishlist', 'success');
      }
    } catch {
      // Rollback
      if (wasInWishlist) {
        setProductIds(prev => new Set(prev).add(productId));
      } else {
        setProductIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
      }
      showToast('Failed to update wishlist', 'error');
    }
  };

  const isInWishlist = useCallback((productId: number) => {
    return productIds.has(productId);
  }, [productIds]);

  return (
    <WishlistContext.Provider value={{ items, productIds, loading, fetchWishlist, toggleWishlist, isInWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within WishlistProvider');
  return context;
}
