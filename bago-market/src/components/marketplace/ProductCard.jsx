import { Link } from 'react-router-dom';
import { ShoppingCart, Heart, Star, MapPin, Sparkles, Package } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useToast } from '../../context/ToastContext';
import { recommendationsAPI } from '../../api/services';

export default function ProductCard({ product, badge }) {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const { showToast } = useToast();

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { openLogin(); return; }
    if (user.role === 'seller') {
      showToast('Seller accounts cannot purchase products. Please use a buyer account.', 'warning');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admin accounts cannot purchase products.', 'warning');
      return;
    }
    if (user.role === 'buyer') {
      addToCart(product.id);
      recommendationsAPI.track({ product_id: product.id, interaction_type: 'add_to_cart' }).catch(() => {});
    }
  };

  const handleClick = () => {
    if (user) {
      recommendationsAPI.track({ product_id: product.id, interaction_type: 'click' }).catch(() => {});
    }
  };

  const inStock = product.stock > 0 || product.is_available;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <Link
      to={`/product/${product.id}`}
      onClick={handleClick}
      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-primary-200 hover:shadow-xl transition-all duration-300 flex flex-col"
    >
      {/* Image */}
      <div className="relative bg-gray-50 overflow-hidden" style={{ aspectRatio: '1/1' }}>
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <Package size={36} />
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Top-left badge */}
        {badge ? (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-accent-400 text-primary-900 px-2 py-1 rounded-full text-[10px] font-bold shadow">
            <Sparkles size={9} /> {badge}
          </div>
        ) : isLowStock ? (
          <div className="absolute top-2.5 left-2.5 bg-red-500 text-white px-2 py-1 rounded-full text-[10px] font-bold">
            Only {product.stock} left
          </div>
        ) : null}

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}

        {/* Wishlist btn on hover */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute top-2.5 right-2.5 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 text-gray-400"
        >
          <Heart size={14} />
        </button>

        {/* Add to cart on hover — only shown to buyers and guests */}
        {inStock && (!user || user.role === 'buyer') && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddToCart}
              className="w-full flex items-center justify-center gap-1.5 bg-white text-primary-900 py-2 rounded-xl text-xs font-bold hover:bg-accent-400 transition-colors"
            >
              <ShoppingCart size={13} /> Add to Cart
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <p className="text-[11px] text-gray-400 font-medium">{product.category_name}</p>

        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-primary-800 transition-colors">
          {product.name}
        </h3>

        {/* Rating & sold */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex items-center gap-0.5">
            <Star size={11} className="text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-gray-700">{Number(product.rating || 0).toFixed(1)}</span>
          </div>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">{product.sold_count || 0} sold</span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <MapPin size={9} />
          <span className="truncate">{product.barangay_name || product.store_name || 'Bago City'}</span>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-gray-50">
          <div>
            {product.variant_count > 0 && product.min_variant_price != null ? (
              <p className="text-base font-bold text-primary-800">
                {Number(product.min_variant_price).toFixed(0) === Number(product.max_variant_price).toFixed(0)
                  ? `₱${Number(product.min_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
                  : `₱${Number(product.min_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })} – ₱${Number(product.max_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
                }
              </p>
            ) : (
              <p className="text-base font-bold text-primary-800">
                ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
              </p>
            )}
          </div>
          {inStock && (!user || user.role === 'buyer') && (
            <button
              onClick={handleAddToCart}
              className="md:hidden w-7 h-7 bg-primary-800 rounded-lg flex items-center justify-center hover:bg-primary-900 transition-colors"
              aria-label="Add to cart"
            >
              <ShoppingCart size={12} className="text-white" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
