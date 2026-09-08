import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  MapPin,
  ShoppingCart,
  Heart,
  Package,
  Share2,
  User,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react-native';
import { productsAPI, recommendationsAPI } from '../../services/api';
import { IMAGE_BASE_URL } from '../../constants/api';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWishlist } from '../../context/WishlistContext';
import { COLORS } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH;

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

// Star rating display
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          color="#facc15"
          fill={i <= rating ? '#facc15' : 'none'}
        />
      ))}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const imageScrollRef = useRef<ScrollView>(null);

  // Recommendations state
  const [recommended, setRecommended] = useState<any[]>([]);
  const [recPage, setRecPage] = useState(1);
  const [recHasMore, setRecHasMore] = useState(true);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await productsAPI.detail(Number(id));
        setProduct(data.product);
        // Track view interaction for AI recommendations
        recommendationsAPI.track({ product_id: Number(id), interaction_type: 'view' }).catch(() => {});
      } catch {
        showToast('Failed to load product', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  // Fetch AI-powered similar products
  const fetchRecommended = useCallback(async (page: number, append = false) => {
    if (!product?.id) return;
    setRecLoading(true);
    try {
      // Use AI similar endpoint first, fall back to category filter
      const res = await recommendationsAPI.get({
        type: 'similar',
        product_id: product.id,
        limit: 10,
      }).catch(() => null);

      let items: any[] = [];
      if (res && (res.recommendations || []).length > 0) {
        items = (res.recommendations || []).filter((p: any) => String(p.id) !== String(id));
      } else {
        // Fallback: regular products list by category
        const fallback = await productsAPI.list({
          category: product.category_slug || undefined,
          limit: 10,
          page,
        });
        items = (fallback.products || []).filter((p: any) => String(p.id) !== String(id));
        setRecHasMore(page < (fallback.total_pages || 1));
      }

      if (append) {
        setRecommended(prev => {
          const existingIds = new Set(prev.map((p: any) => p.id));
          const unique = items.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });
      } else {
        // Deduplicate by id in case API returns dupes
        const seen = new Set<number>();
        setRecommended(items.filter((p: any) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        }));
      }
    } catch {}
    finally { setRecLoading(false); }
  }, [product?.id, product?.category_slug, id]);

  useEffect(() => {
    if (product) {
      setRecPage(1);
      setRecommended([]);
      fetchRecommended(1, false);
    }
  }, [product, fetchRecommended]);

  const loadMoreRecommended = () => {
    if (!recHasMore || recLoading) return;
    const next = recPage + 1;
    setRecPage(next);
    fetchRecommended(next, true);
  };

  const handleAddToCart = () => {
    if (!user) {
      router.push('/auth/login' as any);
      return;
    }
    addToCart(Number(id), quantity);
    // Track add_to_cart interaction for AI
    recommendationsAPI.track({ product_id: Number(id), interaction_type: 'add_to_cart' }).catch(() => {});
  };

  // Build all image URLs
  const allImages: string[] = (() => {
    if (!product) return [];
    const images: string[] = [];
    if (product.images && product.images.length > 0) {
      const sorted = [...product.images].sort((a: any, b: any) => {
        if (a.is_primary === '1' || a.is_primary === 1) return -1;
        if (b.is_primary === '1' || b.is_primary === 1) return 1;
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      });
      sorted.forEach((img: any) => {
        const url = buildImageUrl(img.image_url);
        if (url) images.push(url);
      });
    }
    if (images.length === 0 && product.primary_image) {
      const url = buildImageUrl(product.primary_image);
      if (url) images.push(url);
    }
    return images;
  })();

  // Reviews from API
  const reviews = (product?.reviews || []).map((r: any) => ({
    id: r.id,
    user_name: r.full_name || 'Anonymous',
    rating: Number(r.rating),
    comment: r.review || r.comment || '',
    date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
    helpful: 0,
  }));

  const onMainScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeImageIndex) setActiveImageIndex(index);
  };

  const scrollToImage = (index: number) => {
    setActiveImageIndex(index);
    imageScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  // Handle scroll end to load more recommendations (infinite scroll)
  const handleMainScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    if (isNearBottom && recHasMore && !recLoading) {
      loadMoreRecommended();
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top, height: insets.top + 50 }} />
        <ProgressBar visible />
        <View style={{ padding: 16 }}>
          <Skeleton height={SCREEN_WIDTH - 32} borderRadius={16} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Skeleton width={60} height={60} borderRadius={8} />
            <Skeleton width={60} height={60} borderRadius={8} />
            <Skeleton width={60} height={60} borderRadius={8} />
          </View>
          <View style={{ gap: 12, marginTop: 20 }}>
            <Skeleton width={80} height={14} />
            <Skeleton width="90%" height={22} />
            <Skeleton width={120} height={28} />
          </View>
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Package size={48} color={COLORS.gray[300]} />
        <Text style={{ color: COLORS.gray[500], marginTop: 16 }}>Product not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, backgroundColor: COLORS.primary[800], paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // PHP returns values as strings — cast explicitly before comparing
  const stockNum = Number(product.stock ?? 0);
  const isAvailable = Number(product.is_available ?? 1) !== 0;
  const inStock = stockNum > 0 || isAvailable;
  const avgRating = Number(product.rating || 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Blue top bar */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Product Details</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => { if (!user) router.push('/auth/login' as any); else toggleWishlist(Number(id)); }}
            style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={16} color={product && isInWishlist(Number(id)) ? '#ef4444' : '#fff'} fill={product && isInWishlist(Number(id)) ? '#ef4444' : 'none'} />
          </TouchableOpacity>
          <TouchableOpacity style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Share2 size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleMainScroll}
        scrollEventThrottle={200}
      >
        {/* ── Image Carousel ── */}
        {allImages.length > 0 ? (
          <View>
            <ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onMainScroll}
              scrollEventThrottle={16}
              nestedScrollEnabled
            >
              {allImages.map((uri, index) => (
                <View key={index} style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: '#f8fafc' }}>
                  <Image source={{ uri }} style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
            {allImages.length > 1 && (
              <View style={{ position: 'absolute', bottom: 12, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{activeImageIndex + 1}/{allImages.length}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={64} color={COLORS.gray[300]} />
          </View>
        )}

        {/* Thumbnails */}
        {allImages.length > 1 && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {allImages.map((uri, index) => (
                <TouchableOpacity key={index} onPress={() => scrollToImage(index)}
                  style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: activeImageIndex === index ? COLORS.primary[800] : '#e5e7eb' }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Product Info ── */}
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
          {/* Price */}
          <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary[800] }}>
            ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
          </Text>

          {/* Product name */}
          <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.gray[900], lineHeight: 20, marginTop: 8 }}>
            {product.name}
          </Text>

          {/* Rating | Sold | Category | Stock — one row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={12} color={COLORS.accent[500]} fill={COLORS.accent[500]} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700] }}>{avgRating.toFixed(1)}</Text>
            </View>
            <View style={{ width: 1, height: 12, backgroundColor: COLORS.gray[200] }} />
            <Text style={{ fontSize: 12, color: COLORS.gray[500] }}>{product.sold_count || 0} Sold</Text>
            <View style={{ width: 1, height: 12, backgroundColor: COLORS.gray[200] }} />
            <View style={{ backgroundColor: COLORS.primary[50], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.primary[800] }}>{product.category_name}</Text>
            </View>
            <View style={{ width: 1, height: 12, backgroundColor: COLORS.gray[200] }} />
            {inStock ? (
              <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '500' }}>In Stock ({product.stock})</Text>
            ) : (
              <Text style={{ fontSize: 12, color: '#991b1b', fontWeight: '500' }}>Out of Stock</Text>
            )}
          </View>
        </View>

        {/* ── Shipping / Location ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MapPin size={15} color={COLORS.primary[800]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>Ships from</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[800], marginTop: 1 }}>
                {product.barangay_name || 'Bago City'}, Negros Occidental
              </Text>
            </View>
          </View>
        </View>

        {/* ── Description ── */}
        {product.description && (
          <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[900], marginBottom: 8 }}>Product Description</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray[600], lineHeight: 20 }}>{product.description}</Text>
          </View>
        )}

        {/* Seller Profile Card */}
        {product.store_name && (
            <View style={{ backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {/* Store avatar */}
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primary[100] }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary[800] }}>
                    {(product.store_name || 'S').charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Store info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>{product.store_name}</Text>
                  {product.seller_name && (
                    <Text style={{ fontSize: 11, color: COLORS.gray[500], marginTop: 1 }}>{product.seller_name}</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Star size={10} color="#facc15" fill="#facc15" />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.gray[600] }}>
                        {(Number(product.seller_rating) > 0 ? Number(product.seller_rating) : Number(product.rating) > 0 ? Number(product.rating) : 0).toFixed(1)}
                      </Text>
                    </View>
                    {product.seller_barangay && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <MapPin size={9} color={COLORS.gray[400]} />
                        <Text style={{ fontSize: 10, color: COLORS.gray[500] }}>{product.seller_barangay}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Visit Store button */}
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/store/[sellerId]' as any,
                    params: {
                      sellerId: String(product.seller_id),
                      storeName: product.store_name || '',
                      sellerName: product.seller_name || '',
                      sellerRating: String(Number(product.seller_rating) > 0 ? product.seller_rating : Number(product.rating) > 0 ? product.rating : 0),
                      sellerSales: String(product.seller_total_sales || 0),
                      sellerBarangay: product.seller_barangay || '',
                    }
                  })}
                  style={{ backgroundColor: COLORS.primary[800], paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Visit Store</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* ── Reviews Section ── */}
        <View style={{ marginTop: 16, borderTopWidth: 6, borderTopColor: '#f3f4f6' }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} color={COLORS.primary[800]} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Product Reviews</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Star size={12} color="#facc15" fill="#facc15" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700] }}>{avgRating.toFixed(1)}/5</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>({Number(product.rating_count) || reviews.length})</Text>
              </View>
            </View>

            {reviews.length > 0 ? (
              <>
                {/* Rating summary bar */}
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, fontWeight: '700', color: COLORS.primary[800] }}>{avgRating.toFixed(1)}</Text>
                    <StarRating rating={Math.round(avgRating)} size={11} />
                    <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 4 }}>{Number(product.rating_count) || reviews.length} reviews</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    {[5, 4, 3, 2, 1].map(star => {
                      const starCount = reviews.filter((r: any) => Number(r.rating) === star).length;
                      const pct = reviews.length > 0 ? Math.round((starCount / reviews.length) * 100) : 0;
                      return (
                        <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 10, color: COLORS.gray[500], width: 8 }}>{star}</Text>
                          <Star size={9} color="#facc15" fill="#facc15" />
                          <View style={{ flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 }}>
                            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#facc15', borderRadius: 2 }} />
                          </View>
                          <Text style={{ fontSize: 9, color: COLORS.gray[400], width: 24 }}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Reviews list */}
                {reviews.slice(0, 5).map((review: any, index: number) => (
                  <View key={review.id || index} style={{ paddingVertical: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#f3f4f6' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center' }}>
                        <User size={14} color={COLORS.primary[800]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[900] }}>{review.user_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <StarRating rating={review.rating} size={10} />
                          <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{review.date}</Text>
                        </View>
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={{ fontSize: 12, color: COLORS.gray[600], lineHeight: 18 }}>{review.comment}</Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <MessageSquare size={32} color={COLORS.gray[300]} />
                <Text style={{ fontSize: 12, color: COLORS.gray[400], marginTop: 8 }}>No reviews yet</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray[300], marginTop: 2 }}>Be the first to review this product</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Similar Products (Same Category) ── */}
        <View style={{ borderTopWidth: 6, borderTopColor: '#f3f4f6', paddingTop: 16 }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>Similar Products</Text>
            <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>{product.category_name}</Text>
          </View>

          {recommended.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 }}>
              {recommended.map((item, index) => (
                <ProductCard key={`similar-${item.id}-${index}`} product={item} />
              ))}
            </View>
          ) : !recLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Package size={32} color={COLORS.gray[300]} />
              <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 8 }}>No similar products found</Text>
            </View>
          ) : null}

          {/* Loading more indicator */}
          {recLoading && (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary[800]} />
              <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 6 }}>Loading more...</Text>
            </View>
          )}

          {/* End indicator */}
          {!recHasMore && recommended.length > 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>No more similar products</Text>
            </View>
          )}
        </View>

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 12, paddingTop: 10, paddingBottom: insets.bottom + 10 }}>
        {inStock ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Add to Cart */}
            <TouchableOpacity
              onPress={handleAddToCart}
              style={{ flex: 2, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.primary[800], paddingVertical: 13, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <ShoppingCart size={16} color={COLORS.primary[800]} />
              <Text style={{ color: COLORS.primary[800], fontWeight: '700', fontSize: 13 }}>Add to Cart</Text>
            </TouchableOpacity>

            {/* Buy Now */}
            <TouchableOpacity
              onPress={() => {
                if (!user) { router.push('/auth/login' as any); return; }
                router.push(`/checkout?buyNow=true&productId=${id}&quantity=1` as any);
              }}
              style={{ flex: 3, backgroundColor: COLORS.primary[800], paddingVertical: 13, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: COLORS.gray[200], paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}>
            <Text style={{ color: COLORS.gray[500], fontWeight: '700', fontSize: 14 }}>Out of Stock</Text>
          </View>
        )}
      </View>
    </View>
  );
}
