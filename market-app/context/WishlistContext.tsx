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
      // Ensure all product_id values are numbers — PHP returns strings
      const normalized = wishlist.map((item: any) => ({
        ...item,
        product_id: Number(item.product_id),
        id: Number(item.id),
      }));
      setItems(normalized);
      setProductIds(new Set(normalized.map((item: any) => Number(item.product_id))));
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

    // Optimistic toggle — flip the heart color immediately, no server round-trip first
    if (wasInWishlist) {
      setProductIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
      setItems(prev => prev.filter(item => Number(item.product_id) !== productId));
    } else {
      setProductIds(prev => new Set(prev).add(productId));
      // We don't have full product data here — wishlist tab will refresh on focus
    }

    try {
      const res = await wishlistAPI.toggle({ product_id: productId });
      if (res.action === 'added') {
        showToast('Added to wishlist', 'success');
        // Fetch full item data in background so wishlist tab has the product details
        // Don't await — don't let the fetch overwrite our optimistic productIds state
        wishlistAPI.get().then((data: any) => {
          const wishlist = data.wishlist || data.items || data.products || [];
          setItems(wishlist);
          // Rebuild productIds from server truth — only after add, not remove
          setProductIds(new Set(wishlist.map((item: any) => Number(item.product_id))));
        }).catch(() => {});
      } else {
        showToast('Removed from wishlist', 'success');
        // State already updated optimistically above — nothing else needed
      }
    } catch {
      // Rollback on network error
      if (wasInWishlist) {
        setProductIds(prev => new Set(prev).add(productId));
      } else {
        setProductIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
        setItems(prev => prev.filter(item => Number(item.product_id) !== productId));
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
