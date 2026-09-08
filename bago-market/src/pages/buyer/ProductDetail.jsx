import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Star, MapPin, Minus, Plus, Store, ChevronRight, Sparkles, Truck, Shield, RotateCcw, Package, MessageCircle } from 'lucide-react';
import { productsAPI, recommendationsAPI, wishlistAPI } from '../../api/services';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAuthModal } from '../../context/AuthModalContext';
import ProductCard from '../../components/marketplace/ProductCard';
import { PageLoader } from '../../components/common/LoadingSpinner';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openLogin } = useAuthModal();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await productsAPI.detail(id);
        setProduct(res.data.product);
        // Track view for AI recommendations engine
        if (user) {
          recommendationsAPI.track({ product_id: Number(id), interaction_type: 'view' }).catch(() => {});
        }
        const [simRes, aiRes] = await Promise.all([
          recommendationsAPI.get({ type: 'similar', product_id: id, limit: 6 }).catch(() => ({ data: { recommendations: [] } })),
          recommendationsAPI.get({ type: 'for_you', limit: 6 }).catch(() => ({ data: { recommendations: [] } })),
        ]);
        setSimilarProducts(simRes.data.recommendations);
        setAiRecommendations(aiRes.data.recommendations);
      } catch {
        showToast('Product not found.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
    setQuantity(1);
    setSelectedImage(0);
    window.scrollTo(0, 0);
  }, [id]);

  const handleAddToCart = () => {
    if (!user) { openLogin(); return; }
    addToCart(product.id, quantity);
    // Track add_to_cart for AI engine
    recommendationsAPI.track({ product_id: product.id, interaction_type: 'add_to_cart' }).catch(() => {});
  };

  const handleBuyNow = () => {
    if (!user) { openLogin(); return; }
    addToCart(product.id, quantity);
    recommendationsAPI.track({ product_id: product.id, interaction_type: 'add_to_cart' }).catch(() => {});
    navigate('/cart');
  };

  const handleWishlist = async () => {
    if (!user) { openLogin(); return; }
    try {
      const res = await wishlistAPI.toggle({ product_id: product.id });
      setIsWishlisted(res.data.action === 'added');
      showToast(res.data.message, 'success');
    } catch {
      showToast('Failed to update wishlist.', 'error');
    }
  };

  if (loading) return <PageLoader />;
  if (!product) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <Package size={48} className="text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500">Product not found.</p>
    </div>
  );

  const images = product.images?.length > 0
    ? product.images
    : product.primary_image
      ? [{ image_url: product.primary_image, id: 0 }]
      : [];

  const inStock = product.stock > 0;

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-500">
          <Link to="/" className="hover:text-primary-800 transition-colors">Home</Link>
          <ChevronRight size={12} />
          <Link to="/marketplace" className="hover:text-primary-800 transition-colors">Marketplace</Link>
          <ChevronRight size={12} />
          <span className="text-gray-900 truncate max-w-xs">{product.name}</span>
        </nav>
      </div>

      {/* Main Product Section */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* ── Left: Images ── */}
            <div className="p-6 border-r border-gray-100">
              {/* Main image */}
              <div className="relative bg-gray-50 rounded-xl overflow-hidden mb-3" style={{ aspectRatio: '1/1', maxHeight: '420px' }}>
                {images.length > 0 && images[selectedImage]?.image_url ? (
                  <img
                    src={images[selectedImage].image_url}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={64} className="text-gray-300" />
                  </div>
                )}
                {/* Wishlist floating button */}
                <button
                  onClick={handleWishlist}
                  className={`absolute top-3 right-3 w-9 h-9 rounded-full shadow-md flex items-center justify-center transition-colors ${isWishlisted ? 'bg-red-50 text-red-500' : 'bg-white text-gray-400 hover:text-red-500'}`}
                >
                  <Heart size={18} className={isWishlisted ? 'fill-red-500' : ''} />
                </button>
                {/* Out of stock overlay */}
                {!inStock && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                    <span className="bg-white text-gray-800 font-bold text-sm px-4 py-2 rounded-full">Out of Stock</span>
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={img.id ?? idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${idx === selectedImage ? 'border-primary-800 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Product Info ── */}
            <div className="p-6 flex flex-col gap-4">
              {/* Title & meta */}
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs bg-primary-50 text-primary-800 px-2 py-0.5 rounded-full font-medium">{product.category_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${product.condition === 'new' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                    {product.condition}
                  </span>
                </div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold text-gray-700">{Number(product.rating).toFixed(1)}</span>
                    <span className="text-gray-400">({product.rating_count || 0} reviews)</span>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">{product.sold_count || 0} sold</span>
                  <span className="text-gray-300">|</span>
                  <span className={inStock ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                    {inStock ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl px-5 py-4">
                <p className="text-3xl font-bold text-primary-800">
                  ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Seller */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                  <Store size={18} className="text-primary-800" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{product.store_name || product.seller_name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={10} />
                    <span>{product.seller_barangay || product.barangay_name || 'Bago City'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-yellow-500">
                  <Star size={11} className="fill-yellow-400" />
                  <span className="font-medium">{Number(product.seller_rating || 0).toFixed(1)}</span>
                </div>
              </div>

              {/* Delivery & payment */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Truck size={15} className="text-primary-700 shrink-0" />
                  <span>Delivery within <strong>Bago City</strong> only</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield size={15} className="text-primary-700 shrink-0" />
                  <span><strong>Cash on Delivery</strong> — pay when you receive</span>
                </div>
              </div>

              {/* Quantity */}
              {inStock && (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Quantity:</span>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold border-x border-gray-300 h-9 flex items-center justify-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">{product.stock} available</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border-2 border-primary-800 text-primary-800 rounded-xl font-semibold text-sm hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={17} /> Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={!inStock}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary-800 text-white rounded-xl font-semibold text-sm hover:bg-primary-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Description & Details ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Description */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-base mb-3">Product Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {product.description || 'No description provided.'}
              </p>
            </div>

            {/* Reviews */}
            {product.reviews?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
                  <MessageCircle size={16} /> Reviews ({product.reviews.length})
                </h3>
                <div className="space-y-4">
                  {product.reviews.map((review, idx) => (
                    <div key={idx} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-sm font-bold text-primary-800 shrink-0">
                        {review.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{review.full_name}</span>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={11} className={i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{review.review}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(review.created_at).toLocaleDateString('en-PH')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Product Details sidebar */}
          <div className="bg-white rounded-xl shadow-sm p-6 h-fit">
            <h3 className="font-bold text-gray-900 text-base mb-4">Product Details</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Category', value: product.category_name },
                { label: 'Condition', value: product.condition ? product.condition.charAt(0).toUpperCase() + product.condition.slice(1) : 'N/A' },
                product.brand && { label: 'Brand', value: product.brand },
                product.sku && { label: 'SKU', value: product.sku },
                { label: 'Location', value: product.barangay_name || 'Bago City' },
              ].filter(Boolean).map((item, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Similar Products</h3>
              <Link to={`/marketplace?category=${product.category_slug}`} className="text-sm text-primary-800 hover:underline font-medium">
                View More
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {similarProducts.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        {/* AI Recommendations */}
        {aiRecommendations.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-accent-400" />
              <h3 className="text-lg font-bold text-gray-900">You May Also Like</h3>
              <span className="px-2 py-0.5 bg-accent-200 text-primary-900 text-[10px] font-bold rounded-full">AI Pick</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {aiRecommendations.map(p => <ProductCard key={p.id} product={p} badge="AI Pick" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
