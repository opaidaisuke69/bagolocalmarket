import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Star, MapPin, Minus, Plus, Store, ChevronRight, Sparkles, Truck, Shield, RotateCcw, Package, MessageCircle, X, ChevronDown, User } from 'lucide-react';
import { productsAPI, recommendationsAPI, wishlistAPI } from '../../api/services';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAuthModal } from '../../context/AuthModalContext';
import ProductCard from '../../components/marketplace/ProductCard';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useSEO } from '../../hooks/useSEO';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);       // Color group
  const [selectedVariant, setSelectedVariant] = useState(null);   // Non-color group (Size, Unit, etc.)
  const [similarProducts, setSimilarProducts] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Reviews panel state
  const [showReviews, setShowReviews]         = useState(false);
  const [reviewFilter, setReviewFilter]       = useState(0);   // 0 = all
  const [allReviews, setAllReviews]           = useState([]);
  const [starCounts, setStarCounts]           = useState({1:0,2:0,3:0,4:0,5:0});
  const [reviewsTotal, setReviewsTotal]       = useState(0);
  const [reviewsPage, setReviewsPage]         = useState(1);
  const [reviewsHasMore, setReviewsHasMore]   = useState(false);
  const [reviewsLoading, setReviewsLoading]   = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openLogin } = useAuthModal();

  // Per-product SEO — updates <title>, description, OG tags and JSON-LD
  useSEO(product ? {
    title: product.name,
    description: product.description
      ? `${product.description.slice(0, 140)}...`
      : `Buy ${product.name} from ${product.store_name || 'local Bago City seller'}. ₱${Number(product.price).toLocaleString()} — Cash on Delivery.`,
    image: product.primary_image,
    url: `${window.location.origin}/product/${product.id}`,
    type: 'product',
    product: {
      name:         product.name,
      description:  product.description,
      price:        product.price,
      stock:        product.stock,
      sku:          product.sku,
      id:           product.id,
      rating:       product.rating,
      rating_count: product.rating_count,
      store_name:   product.store_name,
      seller_name:  product.seller_name,
      images:       product.images?.map(i => i.image_url),
    },
  } : {});

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
    setSelectedColor(null);
    setSelectedVariant(null);
    window.scrollTo(0, 0);
  }, [id]);

  const fetchReviews = async (filter = reviewFilter, page = 1, append = false) => {
    setReviewsLoading(true);
    try {
      const res = await productsAPI.reviews({
        product_id: id,
        rating: filter || undefined,
        page,
        limit: 10,
      });
      const data = res.data;
      setStarCounts(data.star_counts || {1:0,2:0,3:0,4:0,5:0});
      setReviewsTotal(data.total || 0);
      setReviewsHasMore(page < (data.total_pages || 1));
      setAllReviews(prev => append ? [...prev, ...(data.reviews || [])] : (data.reviews || []));
      setReviewsPage(page);
    } catch {}
    setReviewsLoading(false);
  };

  // Lock background scroll when the reviews modal is open
  useEffect(() => {
    if (showReviews) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showReviews]);

  const openReviews = () => {
    setShowReviews(true);
    setReviewFilter(0);
    fetchReviews(0, 1, false);
  };

  const handleFilterChange = (star) => {
    setReviewFilter(star);
    fetchReviews(star, 1, false);
  };

  const handleAddToCart = () => {
    if (!user) { openLogin(); return; }
    if (user.role === 'seller') {
      showToast('Seller accounts cannot purchase products. Please use a buyer account.', 'warning');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admin accounts cannot purchase products.', 'warning');
      return;
    }
    if (product.variations?.length > 0) {
      const hasColors   = product.variations.some(v => v.name === 'Color');
      const hasNonColor = product.variations.some(v => v.name !== 'Color');
      if (hasColors && !selectedColor) {
        showToast('Please select a color first.', 'warning');
        return;
      }
      if (hasNonColor && !selectedVariant) {
        showToast('Please select a variant first.', 'warning');
        return;
      }
    }
    // Pass the non-color variant id to cart (price/stock lives there); color is tracked separately
    const variantId = selectedVariant?.id || null;
    const colorId   = selectedColor?.id   || null;
    addToCart(product.id, quantity, variantId, colorId);
    recommendationsAPI.track({ product_id: product.id, interaction_type: 'add_to_cart' }).catch(() => {});
  };

  const handleBuyNow = () => {
    if (!user) { openLogin(); return; }
    if (user.role === 'seller') {
      showToast('Seller accounts cannot purchase products. Please use a buyer account.', 'warning');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admin accounts cannot purchase products.', 'warning');
      return;
    }
    if (product.variations?.length > 0) {
      const hasColors   = product.variations.some(v => v.name === 'Color');
      const hasNonColor = product.variations.some(v => v.name !== 'Color');
      if (hasColors && !selectedColor) {
        showToast('Please select a color first.', 'warning');
        return;
      }
      if (hasNonColor && !selectedVariant) {
        showToast('Please select a variant first.', 'warning');
        return;
      }
    }
    const variantId = selectedVariant?.id || null;
    const colorId   = selectedColor?.id   || null;
    addToCart(product.id, quantity, variantId, colorId);
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

  // Group variations by name once for use below
  const variationGroups = (product.variations || []).reduce((acc, v) => {
    if (!acc[v.name]) acc[v.name] = [];
    acc[v.name].push(v);
    return acc;
  }, {});
  const hasColorGroup   = 'Color' in variationGroups;
  const nonColorGroups  = Object.entries(variationGroups).filter(([name]) => name !== 'Color');
  const hasNonColorGroup = nonColorGroups.length > 0;

  // Effective stock comes from the selected non-color variant, or product stock
  const effectiveStock = selectedVariant
    ? Number(selectedVariant.stock ?? 0)
    : Number(product.stock ?? 0);

  const inStock = product.variations?.length > 0
    ? product.variations.some(v => Number(v.stock) > 0)
    : effectiveStock > 0;

  // Can add to cart only when all required groups have a selection
  const colorReady   = !hasColorGroup   || selectedColor   !== null;
  const variantReady = !hasNonColorGroup || selectedVariant !== null;
  const selectionReady = colorReady && variantReady;
  const canAddToCart = product.variations?.length > 0
    ? selectionReady && (selectedVariant ? Number(selectedVariant.stock) > 0 : effectiveStock > 0)
    : effectiveStock > 0;

  // When a color has its own image, show that as the main image
  const displayImageUrl = selectedColor?.image_url
    ? selectedColor.image_url
    : (images.length > 0 && images[selectedImage]?.image_url ? images[selectedImage].image_url : null);

  // Price display: use the selected non-color variant's price if available
  const selectedPriceAdjustment = selectedVariant ? Number(selectedVariant.price_adjustment) : 0;

  return (
    <>
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
                {displayImageUrl ? (
                  <img
                    src={displayImageUrl}
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

              {/* Thumbnail strip — hidden when a color image is active */}
              {images.length > 1 && !selectedColor?.image_url && (
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
                    {selectedVariant
                      ? (Number(selectedVariant.stock) > 0 ? `${selectedVariant.stock} in stock` : 'Out of stock')
                      : (inStock ? `${product.stock} in stock` : 'Out of stock')
                    }
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl px-5 py-4">
                {product.variations?.length > 0 ? (
                  selectedVariant ? (
                    /* Non-color variant selected — show exact price */
                    <div>
                      <p className="text-3xl font-bold text-primary-800">
                        ₱{Number(Number(product.price) + selectedPriceAdjustment).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedVariant.name}: <strong>{selectedVariant.value}</strong>
                        {selectedColor && <span className="ml-1">· Color: <strong>{selectedColor.value}</strong></span>}
                      </p>
                    </div>
                  ) : (
                    /* Not fully selected — show range */
                    <div>
                      <p className="text-3xl font-bold text-primary-800">
                        {product.min_variant_price != null && Number(product.min_variant_price).toFixed(2) !== Number(product.max_variant_price).toFixed(2)
                          ? `₱${Number(product.min_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })} – ₱${Number(product.max_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
                          : `₱${Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                        }
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {hasNonColorGroup ? 'Select a variant to see exact price' : selectedColor ? `Color: ${selectedColor.value}` : 'Select options below'}
                      </p>
                    </div>
                  )
                ) : (
                  <p className="text-3xl font-bold text-primary-800">
                    ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                )}
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

              {/* Variants */}
              {product.variations?.length > 0 && (
                <div className="space-y-4">
                  {/* Color group */}
                  {hasColorGroup && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Color:
                        {selectedColor && (
                          <span className="ml-2 font-normal text-gray-500">{selectedColor.value}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {variationGroups['Color'].map((v) => {
                          const isSelected  = selectedColor?.id === v.id;
                          const outOfStock  = Number(v.stock) === 0;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={outOfStock}
                              onClick={() => setSelectedColor(isSelected ? null : v)}
                              title={`${v.value}${outOfStock ? ' (sold out)' : ''}`}
                              className={`relative transition-all rounded-lg overflow-hidden
                                ${isSelected
                                  ? 'ring-2 ring-offset-2 ring-primary-800 scale-105'
                                  : outOfStock
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'hover:scale-105 ring-1 ring-gray-200 hover:ring-primary-400'}`}
                            >
                              {v.image_url ? (
                                <div className="w-14 h-14 relative">
                                  <img src={v.image_url} alt={v.value} className="w-full h-full object-cover" />
                                  {v.hex && (
                                    <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white shadow-sm"
                                      style={{ backgroundColor: v.hex }} />
                                  )}
                                  {outOfStock && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                      <span className="text-[9px] text-gray-500 font-bold leading-tight text-center px-0.5">Sold<br/>Out</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-full border-2 border-white shadow"
                                  style={{ backgroundColor: v.hex || '#CCCCCC' }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {hasColorGroup && !selectedColor && (
                        <p className="text-xs text-amber-600 font-medium mt-1">← Pick a color to continue</p>
                      )}
                    </div>
                  )}

                  {/* Non-color variant groups (Size, Unit, etc.) */}
                  {nonColorGroups.map(([groupName, options]) => (
                    <div key={groupName}>
                      <p className="text-sm font-semibold text-gray-700 mb-2">{groupName}:</p>
                      <div className="flex flex-wrap gap-2">
                        {options.map((v) => {
                          const isSelected = selectedVariant?.id === v.id;
                          const outOfStock = Number(v.stock) === 0;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={outOfStock}
                              onClick={() => setSelectedVariant(isSelected ? null : v)}
                              className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all
                                ${isSelected
                                  ? 'border-primary-800 bg-primary-800 text-white'
                                  : outOfStock
                                    ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-primary-600 hover:text-primary-800'
                                }`}
                            >
                              {v.value}
                              {Number(v.price_adjustment) !== 0 && (
                                <span className="ml-1 text-xs opacity-80">
                                  {Number(v.price_adjustment) > 0 ? '+' : ''}₱{Math.abs(Number(v.price_adjustment)).toLocaleString()}
                                </span>
                              )}
                              {outOfStock && <span className="ml-1 text-[10px]">(sold out)</span>}
                            </button>
                          );
                        })}
                      </div>
                      {hasNonColorGroup && !selectedVariant && (
                        <p className="text-xs text-amber-600 font-medium mt-1">← Select a {groupName.toLowerCase()} to continue</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                      onClick={() => setQuantity(q => Math.min(
                        selectedVariant ? Number(selectedVariant.stock) : product.stock,
                        q + 1
                      ))}
                      className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    {selectedVariant
                      ? `${selectedVariant.stock} available`
                      : `${product.stock} available`}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              {user && (user.role === 'seller' || user.role === 'admin') ? (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {user.role === 'seller' ? 'Seller accounts cannot purchase products.' : 'Admin accounts cannot purchase products.'}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Only buyer accounts can add items to cart and check out.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleAddToCart}
                    disabled={!canAddToCart}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border-2 border-primary-800 text-primary-800 rounded-xl font-semibold text-sm hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={17} /> Add to Cart
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!canAddToCart}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary-800 text-white rounded-xl font-semibold text-sm hover:bg-primary-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Buy Now
                  </button>
                </div>
              )}
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
            <div className="bg-white rounded-xl shadow-sm p-6">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <MessageCircle size={16} /> Reviews ({product.rating_count || 0})
                </h3>
                {(product.rating_count > 0 || product.reviews?.length > 0) && (
                  <button
                    onClick={openReviews}
                    className="text-sm text-primary-800 hover:underline font-semibold flex items-center gap-1"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                )}
              </div>

              {/* Rating summary */}
              {product.reviews?.length > 0 && (
                <div className="flex gap-4 items-center mb-5 p-4 bg-gray-50 rounded-xl">
                  <div className="text-center shrink-0">
                    <p className="text-4xl font-bold text-primary-800">{Number(product.rating).toFixed(1)}</p>
                    <div className="flex gap-0.5 justify-center mt-1">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={12} className={i <= Math.round(Number(product.rating)) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{product.rating_count || 0} reviews</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {[5,4,3,2,1].map(star => {
                      const count = product.reviews.filter(r => Number(r.rating) === star).length;
                      const pct   = product.reviews.length > 0 ? Math.round((count / product.reviews.length) * 100) : 0;
                      return (
                        <div key={star} className="flex items-center gap-1.5 text-xs">
                          <span className="w-3 shrink-0 text-gray-500 text-right">{star}</span>
                          <Star size={9} className="text-yellow-400 fill-yellow-400 shrink-0" />
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="shrink-0 min-w-[20px] text-gray-400 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview: up to 3 reviews */}
              {product.reviews?.length > 0 ? (
                <div className="space-y-4">
                  {product.reviews.slice(0, 3).map((review, idx) => (
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
                  {product.reviews.length > 3 && (
                    <button onClick={openReviews} className="w-full py-2.5 text-sm font-semibold text-primary-800 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors">
                      View all {product.rating_count || product.reviews.length} reviews
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No reviews yet.</p>
              )}
            </div>
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

      {/* ── All Reviews Modal ── */}
      {showReviews && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReviews(false)} />

          {/* Sheet */}
          <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

            {/* ── Colored header ── */}
            <div className="bg-primary-800 px-6 pt-6 pb-5 shrink-0">
              {/* Title row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">Reviews</h2>
                  <p className="text-white/50 text-xs mt-1 truncate max-w-xs">{product.name}</p>
                </div>
                <button
                  onClick={() => setShowReviews(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors shrink-0 ml-4"
                >
                  <X size={15} className="text-white" />
                </button>
              </div>

              {/* Score + bars */}
              <div className="flex items-center gap-5">
                {/* Big score */}
                <div className="text-center shrink-0">
                  <p className="text-5xl font-black text-white leading-none">{Number(product.rating).toFixed(1)}</p>
                  <div className="flex gap-0.5 justify-center mt-2">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={13} className={i <= Math.round(Number(product.rating)) ? 'text-yellow-400 fill-yellow-400' : 'text-white/30 fill-white/10'} />
                    ))}
                  </div>
                  <p className="text-white/50 text-[11px] mt-1.5">
                    {product.rating_count || 0} reviews
                  </p>
                </div>
                {/* Bars */}
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(star => {
                    const count = starCounts[star] || 0;
                    const total = Object.values(starCounts).reduce((a, b) => a + b, 0);
                    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                    const active = reviewFilter === star;
                    return (
                      <button
                        key={star}
                        onClick={() => handleFilterChange(active ? 0 : star)}
                        className={`w-full flex items-center gap-2 text-xs rounded px-1 py-0.5 transition-colors ${active ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                      >
                        <span className="w-3 text-white/70 text-right shrink-0">{star}</span>
                        <Star size={9} className="text-yellow-400 fill-yellow-400 shrink-0" />
                        <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${active ? 'bg-accent-400' : 'bg-white/70'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 min-w-[22px] text-white/70 text-right">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Filter tabs ── */}
            <div className="flex gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 overflow-x-auto no-scrollbar shrink-0">
              {[{label: 'All', val: 0}, {label: '5 ★', val: 5}, {label: '4 ★', val: 4}, {label: '3 ★', val: 3}, {label: '2 ★', val: 2}, {label: '1 ★', val: 1}].map(tab => {
                const count  = tab.val === 0
                  ? Object.values(starCounts).reduce((a, b) => a + b, 0)
                  : (starCounts[tab.val] || 0);
                const active = reviewFilter === tab.val;
                return (
                  <button
                    key={tab.val}
                    onClick={() => handleFilterChange(tab.val)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border-2 transition-all ${
                      active
                        ? 'bg-primary-800 text-white border-primary-800 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Reviews list ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {reviewsLoading && allReviews.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400">Loading reviews…</div>
              ) : allReviews.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Star size={24} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">
                    {reviewFilter > 0 ? `No ${reviewFilter}-star reviews` : 'No reviews yet'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {reviewFilter > 0 ? 'Try a different filter.' : 'Be the first to review this product.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allReviews.map((review, idx) => (
                    <div key={review.id || idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      {/* Top row */}
                      <div className="flex items-start gap-3 mb-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-primary-800 flex items-center justify-center text-sm font-black text-white shrink-0">
                          {review.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{review.full_name || 'Anonymous'}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {review.created_at ? new Date(review.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                          </p>
                        </div>
                        {/* Star badge */}
                        <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-lg shrink-0">
                          <Star size={11} className="text-yellow-500 fill-yellow-400" />
                          <span className="text-xs font-black text-yellow-700">{Number(review.rating)}.0</span>
                        </div>
                      </div>
                      {/* Stars */}
                      <div className="flex gap-0.5 mb-2.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={13} className={i < Number(review.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'} />
                        ))}
                      </div>
                      {/* Text */}
                      {review.review && (
                        <p className="text-sm text-gray-600 leading-relaxed">{review.review}</p>
                      )}
                    </div>
                  ))}

                  {reviewsHasMore && (
                    <button
                      onClick={() => fetchReviews(reviewFilter, reviewsPage + 1, true)}
                      disabled={reviewsLoading}
                      className="w-full py-3 bg-primary-800 hover:bg-primary-900 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {reviewsLoading ? 'Loading…' : 'Load More Reviews'}
                    </button>
                  )}
                  {!reviewsHasMore && allReviews.length > 0 && (
                    <p className="text-center text-xs text-gray-400 py-2">All reviews loaded</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
