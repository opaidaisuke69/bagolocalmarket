import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface CartItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  price: number;
  quantity: number;
  stock: number;
  store_name: string;
  seller_id?: number;
  seller_name?: string;
  variation_id?: number | null;
  color_variation_id?: number | null;
  variation_label?: string | null;
  color_image_url?: string | null;
  color_hex?: string | null;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  total: number;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addToCart: (productId: number, quantity?: number, variationId?: number | null, colorVariationId?: number | null) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeFromCart: (itemId: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const fetchCart = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await cartAPI.get();
      setItems(data.items || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchCart();
    else setItems([]);
  }, [user, fetchCart]);

  // Optimistic add
  const addToCart = async (productId: number, quantity: number = 1, variationId: number | null = null, colorVariationId: number | null = null) => {
    try {
      await cartAPI.add({ product_id: productId, quantity, variation_id: variationId, color_variation_id: colorVariationId });
      showToast('Added to cart', 'success');
      fetchCart(); // refresh in background
    } catch (err: any) {
      showToast(err.message || 'Failed to add', 'error');
    }
  };

  // Optimistic update — use cart item ID
  const updateQuantity = async (itemId: number, quantity: number) => {
    const prevItems = [...items];
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
    try {
      await cartAPI.update({ item_id: itemId, quantity });
    } catch {
      setItems(prevItems);
      showToast('Failed to update', 'error');
    }
  };

  // Optimistic remove — use cart item ID
  const removeFromCart = async (itemId: number) => {
    const prevItems = [...items];
    setItems(prev => prev.filter(item => item.id !== itemId));
    try {
      await cartAPI.remove({ item_id: itemId });
      showToast('Removed from cart', 'success');
    } catch {
      setItems(prevItems);
      showToast('Failed to remove', 'error');
    }
  };

  const count = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, count, total, loading, fetchCart, addToCart, updateQuantity, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
