import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { cartAPI } from '../api/services';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [], item_count: 0, subtotal: 0 });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();
  const intervalRef = useRef(null);

  const fetchCart = useCallback(async () => {
    if (!user || user.role !== 'buyer') return;
    try {
      const res = await cartAPI.get();
      setCart(res.data);
    } catch {
      // silent fail
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'buyer') {
      setCart({ items: [], item_count: 0, subtotal: 0 });
      return;
    }
    fetchCart();
    // Real-time polling every 3 seconds
    intervalRef.current = setInterval(fetchCart, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchCart, user]);

  const addToCart = async (productId, quantity = 1, variationId = null) => {
    if (!user || user.role !== 'buyer') {
      // The component calling this should handle opening the login modal
      return false;
    }
    // Optimistic update
    setCart(prev => ({ ...prev, item_count: prev.item_count + 1 }));
    try {
      await cartAPI.add({ product_id: productId, quantity, variation_id: variationId });
      showToast('Product added to cart successfully.', 'success');
      await fetchCart();
      return true;
    } catch (err) {
      // Rollback
      setCart(prev => ({ ...prev, item_count: prev.item_count - 1 }));
      showToast(err.response?.data?.message || 'Failed to add to cart.', 'error');
      return false;
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    const prevCart = { ...cart };
    // Optimistic
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, quantity, total: item.price * quantity } : item
      )
    }));
    try {
      await cartAPI.update({ item_id: itemId, quantity });
      await fetchCart();
    } catch {
      setCart(prevCart);
      showToast('Failed to update cart.', 'error');
    }
  };

  const removeFromCart = async (itemId) => {
    const prevCart = { ...cart };
    // Optimistic
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
      item_count: prev.item_count - 1
    }));
    try {
      await cartAPI.remove({ item_id: itemId });
      showToast('Item removed from cart.', 'success');
      await fetchCart();
    } catch {
      setCart(prevCart);
      showToast('Failed to remove item.', 'error');
    }
  };

  return (
    <CartContext.Provider value={{ cart, loading, fetchCart, addToCart, updateQuantity, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
