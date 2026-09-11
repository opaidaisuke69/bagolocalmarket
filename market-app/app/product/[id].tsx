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
  Modal,
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
  X,
  ChevronRight,
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

// ── Reusable rating bar row ──────────────────────────────────────────────────
// Uses onLayout to measure the track and fill with absolute pixel widths
function RatingBarRow({
  star, count, total, onPress, fillColor = '#facc15',
}: {
  star: number; count: number; total: number; onPress?: () => void;
  fillColor?: string;
}) {
  const [trackW, setTrackW] = React.useState(0);
  const ratio = total > 0 ? count / total : 0;
  const fillW = trackW * ratio;
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[600], width: 14, textAlign: 'right', marginRight: 4 }}>
        {star}
      </Text>
      <Star size={10} color="#facc15" fill="#facc15" />
      <View
        onLayout={e => setTrackW(e.nativeEvent.layout.width)}
        style={{ flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, marginHorizontal: 6, overflow: 'hidden' }}
      >
        {trackW > 0 && fillW > 0 && (
          <View style={{ width: fillW, height: 6, backgroundColor: fillColor, borderRadius: 3 }} />
        )}
      </View>
      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[600], width: 28, textAlign: 'right' }}>
        {count}
      </Text>
    </Wrapper>
  );
}

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
  const [selectedColor, setSelectedColor] = useState<any>(null);     // Color group
  const [selectedVariant, setSelectedVariant] = useState<any>(null); // Non-color groups (Size, Unit…)
  const imageScrollRef = useRef<ScrollView>(null);

  // Recommendations state
  const [recommended, setRecommended] = useState<any[]>([]);
  const [recPage, setRecPage] = useState(1);
  const [recHasMore, setRecHasMore] = useState(true);
  const [recLoading, setRecLoading] = useState(false);

  // Reviews modal state
  const [showReviews, setShowReviews]       = useState(false);
  const [reviewFilter, setReviewFilter]     = useState(0);   // 0 = all
  const [allReviews, setAllReviews]         = useState<any[]>([]);
  const [starCounts, setStarCounts]         = useState<Record<number,number>>({1:0,2:0,3:0,4:0,5:0});
  const [reviewsTotal, setReviewsTotal]     = useState(0);
  const [reviewsPage, setReviewsPage]       = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await productsAPI.detail(Number(id));
        setProduct(data.product);
        setSelectedColor(null);
        setSelectedVariant(null);
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

  // When color with image selected, scroll carousel back to top
  useEffect(() => {
    if (selectedColor?.image_url) {
      setActiveImageIndex(0);
      imageScrollRef.current?.scrollTo({ x: 0, animated: true });
    }
  }, [selectedColor]);

  // Trigger recommendation fetch when product loads
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

  const fetchReviews = useCallback(async (filter: number, page: number, append = false) => {
    setReviewsLoading(true);
    try {
      const data = await productsAPI.reviews({
        product_id: Number(id),
        rating:     filter || undefined,
        page,
        limit:      15,
      });
      setStarCounts(data.star_counts   || {1:0,2:0,3:0,4:0,5:0});
      setReviewsTotal(data.total       || 0);
      setReviewsHasMore(page < (data.total_pages || 1));
      setReviewsPage(page);
      setAllReviews(prev => append ? [...prev, ...(data.reviews || [])] : (data.reviews || []));
    } catch {}
    setReviewsLoading(false);
  }, [id]);

  const openReviews = () => {
    setReviewFilter(0);
    setAllReviews([]);
    setShowReviews(true);
    fetchReviews(0, 1, false);
  };

  const handleFilterChange = (star: number) => {
    const next = reviewFilter === star ? 0 : star;
    setReviewFilter(next);
    fetchReviews(next, 1, false);
  };

  const handleAddToCart = () => {
    if (!user) {
      router.push('/auth/login' as any);
      return;
    }
    if ((product?.variations?.length ?? 0) > 0) {
      const hasColors   = (product.variations || []).some((v: any) => v.name === 'Color');
      const hasNonColor = (product.variations || []).some((v: any) => v.name !== 'Color');
      if (hasColors && !selectedColor) {
        showToast('Please select a color first', 'warning');
        return;
      }
      if (hasNonColor && !selectedVariant) {
        showToast('Please select a variant first', 'warning');
        return;
      }
    }
    const variantId = selectedVariant?.id ?? null;
    const colorId   = selectedColor?.id   ?? null;
    addToCart(Number(id), quantity, variantId, colorId);
    recommendationsAPI.track({ product_id: Number(id), interaction_type: 'add_to_cart' }).catch(() => {});
  };

  // Build all image URLs — if a color is selected and has its own image, show ONLY that image
  const allImages: string[] = (() => {
    if (!product) return [];

    // When a color variant has its own image, show only that image
    if (selectedColor?.image_url) {
      const colorUrl = buildImageUrl(selectedColor.image_url);
      if (colorUrl) return [colorUrl];
    }

    // Otherwise show the product's own images
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

  // Group variations once
  const variationGroups: Record<string, any[]> = {};
  (product.variations || []).forEach((v: any) => {
    if (!variationGroups[v.name]) variationGroups[v.name] = [];
    variationGroups[v.name].push(v);
  });
  const hasColorGroup    = 'Color' in variationGroups;
  const nonColorGroups   = Object.entries(variationGroups).filter(([name]) => name !== 'Color');
  const hasNonColorGroup = nonColorGroups.length > 0;

  const inStock = (product.variations?.length ?? 0) > 0
    ? (product.variations || []).some((v: any) => Number(v.stock) > 0)
    : (stockNum > 0 || isAvailable);

  const colorReady   = !hasColorGroup   || selectedColor   !== null;
  const variantReady = !hasNonColorGroup || selectedVariant !== null;
  const selectionReady = colorReady && variantReady;

  const canAddToCart = (product.variations?.length ?? 0) > 0
    ? selectionReady && (selectedVariant ? Number(selectedVariant.stock) > 0 : stockNum > 0 || isAvailable)
    : (stockNum > 0 || isAvailable);

  const selectedPriceAdj = selectedVariant ? Number(selectedVariant.price_adjustment) : 0;

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
          {(product.variations?.length ?? 0) > 0 ? (
            selectedVariant ? (
              <View>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary[800] }}>
                  ₱{Number(Number(product.price) + selectedPriceAdj).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>
                  {selectedVariant.name}: {selectedVariant.value}
                  {selectedColor ? `  ·  Color: ${selectedColor.value}` : ''}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary[800] }}>
                  {product.min_variant_price != null &&
                   Number(product.min_variant_price).toFixed(0) !== Number(product.max_variant_price).toFixed(0)
                    ? `₱${Number(product.min_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })} – ₱${Number(product.max_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
                    : `₱${Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
                  }
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>
                  {hasNonColorGroup
                    ? 'Select a variant to see exact price'
                    : selectedColor ? `Color: ${selectedColor.value}` : 'Select options below'}
                </Text>
              </View>
            )
          ) : (
            <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.primary[800] }}>
              ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
            </Text>
          )}

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
              <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '500' }}>
                {selectedVariant
                  ? (Number(selectedVariant.stock) > 0
                      ? `In Stock (${selectedVariant.stock})`
                      : 'Out of Stock')
                  : (product.variations?.length > 0
                      ? `${(product.variations || []).reduce((s: number, v: any) => s + Number(v.stock || 0), 0)} total`
                      : `In Stock (${product.stock})`)
                }
              </Text>
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

        {/* ── Variants ── */}
        {(product.variations?.length ?? 0) > 0 && (
          <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900], marginBottom: 10 }}>Select Options</Text>

            {/* Color group — swatch style */}
            {hasColorGroup && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[600] }}>Color</Text>
                  {selectedColor && (
                    <Text style={{ fontSize: 12, color: COLORS.primary[800], fontWeight: '600', marginLeft: 6 }}>
                      — {selectedColor.value}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {variationGroups['Color'].map((v: any) => {
                    const isSelected = selectedColor?.id === v.id || selectedColor?.id === Number(v.id);
                    const outOfStock = Number(v.stock) === 0;
                    const imageUrl = v.image_url ? buildImageUrl(v.image_url) : null;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        disabled={outOfStock}
                        onPress={() => setSelectedColor(isSelected ? null : v)}
                        style={{
                          borderRadius: 8,
                          borderWidth: 2.5,
                          borderColor: isSelected ? COLORS.primary[800] : 'transparent',
                          opacity: outOfStock ? 0.4 : 1,
                          overflow: 'hidden',
                        }}
                      >
                        {imageUrl ? (
                          /* Color-specific image thumbnail */
                          <View style={{ width: 56, height: 56, position: 'relative' }}>
                            <Image
                              source={{ uri: imageUrl }}
                              style={{ width: 56, height: 56 }}
                              resizeMode="cover"
                            />
                            {/* Hex dot overlay */}
                            {v.hex && (
                              <View style={{
                                position: 'absolute', bottom: 3, right: 3,
                                width: 12, height: 12, borderRadius: 6,
                                backgroundColor: v.hex, borderWidth: 1.5, borderColor: '#fff',
                              }} />
                            )}
                            {outOfStock && (
                              <View style={{
                                position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(255,255,255,0.6)',
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Text style={{ fontSize: 8, color: COLORS.gray[500], fontWeight: '700', textAlign: 'center' }}>
                                  Sold{'\n'}Out
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          /* Plain color circle */
                          <View style={{
                            width: 36, height: 36, borderRadius: 18,
                            backgroundColor: v.hex || '#CCCCCC',
                          }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!selectedColor && (
                  <Text style={{ fontSize: 11, color: '#d97706', fontWeight: '600', marginTop: 6 }}>
                    Pick a color to continue
                  </Text>
                )}
              </View>
            )}

            {/* Non-color groups — pill style */}
            {nonColorGroups.map(([groupName, options]) => (
              <View key={groupName} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[600], marginBottom: 8 }}>{groupName}:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {options.map((v: any) => {
                    const isSelected = selectedVariant && (selectedVariant.id === v.id || selectedVariant.id === Number(v.id));
                    const outOfStock = Number(v.stock) === 0;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        disabled={outOfStock}
                        onPress={() => { setSelectedVariant(isSelected ? null : v); setQuantity(1); }}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8,
                          borderRadius: 8, borderWidth: 1.5,
                          borderColor: isSelected ? COLORS.primary[800] : outOfStock ? '#e5e7eb' : '#d1d5db',
                          backgroundColor: isSelected ? COLORS.primary[800] : outOfStock ? '#f9fafb' : '#fff',
                        }}
                      >
                        <Text style={{
                          fontSize: 13, fontWeight: '600',
                          color: isSelected ? '#fff' : outOfStock ? COLORS.gray[300] : COLORS.gray[800],
                          textDecorationLine: outOfStock ? 'line-through' : 'none',
                        }}>
                          {v.value}{Number(v.price_adjustment) !== 0
                            ? (Number(v.price_adjustment) > 0 ? ' +₱' : ' -₱') + Math.abs(Number(v.price_adjustment)).toLocaleString()
                            : ''}
                        </Text>
                        {outOfStock && (
                          <Text style={{ fontSize: 9, color: COLORS.gray[400], marginTop: 2 }}>Sold out</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!selectedVariant && (
                  <Text style={{ fontSize: 11, color: '#d97706', fontWeight: '600', marginTop: 6 }}>
                    Select a {groupName.toLowerCase()} to continue
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Quantity stepper (shown when in stock) ── */}
        {inStock && (
          <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[900] }}>Quantity</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>
                  {selectedVariant
                    ? `${Number(selectedVariant.stock)} available`
                    : product.variations?.length > 0
                      ? `${(product.variations || []).reduce((s: number, v: any) => s + Number(v.stock || 0), 0)} total`
                      : `${stockNum} available`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <TouchableOpacity
                  onPress={() => setQuantity(q => Math.max(1, q - 1))}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '400', color: COLORS.primary[800], lineHeight: 24 }}>−</Text>
                </TouchableOpacity>
                <View style={{ width: 44, height: 40, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e5e7eb' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.gray[900] }}>{quantity}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setQuantity(q => Math.min(
                    selectedVariant ? Number(selectedVariant.stock) : stockNum,
                    q + 1
                  ))}
                  style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '400', color: COLORS.primary[800], lineHeight: 24 }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Star size={12} color="#facc15" fill="#facc15" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700] }}>{avgRating.toFixed(1)}/5</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>({Number(product.rating_count) || reviews.length})</Text>
                </View>
                {reviews.length > 0 && (
                  <TouchableOpacity onPress={openReviews} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8, backgroundColor: COLORS.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.primary[800] }}>View All</Text>
                    <ChevronRight size={12} color={COLORS.primary[800]} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {reviews.length > 0 ? (
              <>
                {/* Rating summary bar */}
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                  {/* Left: big score */}
                  <View style={{ alignItems: 'center', marginRight: 16, minWidth: 64 }}>
                    <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.primary[800] }}>{avgRating.toFixed(1)}</Text>
                    <StarRating rating={Math.round(avgRating)} size={11} />
                    <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 4 }}>
                      {Number(product.rating_count) || reviews.length} reviews
                    </Text>
                  </View>
                  {/* Right: bars */}
                  <View style={{ flex: 1 }}>
                    {[5, 4, 3, 2, 1].map((star, idx) => {
                      const starCount = reviews.filter((r: any) => Number(r.rating) === star).length;
                      return (
                        <View key={star} style={{ marginBottom: idx < 4 ? 7 : 0 }}>
                          <RatingBarRow
                            star={star}
                            count={starCount}
                            total={reviews.length}
                            onPress={openReviews}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Preview: up to 3 reviews */}
                {reviews.slice(0, 3).map((review: any, index: number) => (
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

                {/* View all button */}
                {reviews.length > 0 && (
                  <TouchableOpacity
                    onPress={openReviews}
                    style={{ marginTop: 12, paddingVertical: 11, borderWidth: 1, borderColor: COLORS.primary[200], borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.primary[50] }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary[800] }}>
                      View All {Number(product.rating_count) || reviews.length} Reviews
                    </Text>
                  </TouchableOpacity>
                )}
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

        {/* ── All Reviews Modal ── */}
        <Modal
          visible={showReviews}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReviews(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>

            {/* ── Gradient header ── */}
            <View style={{
              backgroundColor: COLORS.primary[800],
              paddingTop: insets.top + 10,
              paddingBottom: 18,
              paddingHorizontal: 16,
            }}>
              {/* Top row: title + close */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>
                    Reviews
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }} numberOfLines={1}>
                    {product.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowReviews(false)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Score row */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Big score */}
                <View style={{ alignItems: 'center', marginRight: 18, minWidth: 70 }}>
                  <Text style={{ fontSize: 44, fontWeight: '900', color: '#fff', lineHeight: 48 }}>
                    {avgRating.toFixed(1)}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={13} color="#facc15" fill={i <= Math.round(avgRating) ? '#facc15' : 'none'} />
                    ))}
                  </View>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                    {Number(product.rating_count) || reviews.length} reviews
                  </Text>
                </View>
                {/* Bars */}
                <View style={{ flex: 1 }}>
                  {[5,4,3,2,1].map((star, idx) => {
                    const count = starCounts[star] || 0;
                    const total = Object.values(starCounts).reduce((a, b) => (a as number) + (b as number), 0) as number;
                    return (
                      <View key={star} style={{ marginBottom: idx < 4 ? 6 : 0 }}>
                        <RatingBarRow
                          star={star}
                          count={count}
                          total={total}
                          onPress={() => handleFilterChange(star)}
                          fillColor={reviewFilter === star ? COLORS.accent[400] : 'rgba(255,255,255,0.7)'}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* ── Filter tabs ── */}
            <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row' }}
              >
                {[
                  { label: 'All', val: 0 },
                  { label: '5 ★', val: 5 },
                  { label: '4 ★', val: 4 },
                  { label: '3 ★', val: 3 },
                  { label: '2 ★', val: 2 },
                  { label: '1 ★', val: 1 },
                ].map((tab, i) => {
                  const cnt    = tab.val === 0
                    ? (Object.values(starCounts).reduce((a, b) => (a as number) + (b as number), 0) as number)
                    : (starCounts[tab.val] || 0);
                  const active = reviewFilter === tab.val;
                  return (
                    <TouchableOpacity
                      key={tab.val}
                      activeOpacity={0.75}
                      onPress={() => {
                        const next = tab.val === reviewFilter && tab.val !== 0 ? 0 : tab.val;
                        setReviewFilter(next);
                        fetchReviews(next, 1, false);
                      }}
                      style={{
                        marginRight: i < 5 ? 8 : 0,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: active ? COLORS.primary[800] : '#e5e7eb',
                        backgroundColor: active ? COLORS.primary[800] : '#fff',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : COLORS.gray[600], marginRight: 5 }}>
                        {tab.label}
                      </Text>
                      <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#f3f4f6', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#fff' : COLORS.gray[500] }}>{cnt}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Reviews list ── */}
            {reviewsLoading && allReviews.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary[800]} />
                <Text style={{ fontSize: 12, color: COLORS.gray[400], marginTop: 12 }}>Loading reviews…</Text>
              </View>
            ) : allReviews.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Star size={28} color={COLORS.gray[300]} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.gray[600], textAlign: 'center' }}>
                  {reviewFilter > 0 ? `No ${reviewFilter}-star reviews` : 'No reviews yet'}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.gray[400], marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                  {reviewFilter > 0 ? 'Try a different star filter.' : 'Be the first to review this product.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={allReviews}
                keyExtractor={(item, i) => String(item.id || i)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 28 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                renderItem={({ item }) => {
                  const initial = item.full_name?.charAt(0)?.toUpperCase() || '?';
                  const dateStr = item.created_at
                    ? new Date(item.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '';
                  const ratingNum = Number(item.rating);
                  return (
                    <View style={{
                      backgroundColor: '#fff',
                      borderRadius: 14,
                      padding: 14,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 1,
                    }}>
                      {/* Top row: avatar + name + date */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: COLORS.primary[800],
                          alignItems: 'center', justifyContent: 'center',
                          marginRight: 10,
                        }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>
                            {item.full_name || 'Anonymous'}
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 1 }}>{dateStr}</Text>
                        </View>
                        {/* Star badge */}
                        <View style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: '#fef9c3',
                          paddingHorizontal: 8, paddingVertical: 4,
                          borderRadius: 8,
                        }}>
                          <Star size={11} color="#f59e0b" fill="#f59e0b" />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#92400e', marginLeft: 3 }}>
                            {ratingNum}.0
                          </Text>
                        </View>
                      </View>
                      {/* Star row */}
                      <View style={{ flexDirection: 'row', marginBottom: item.review ? 8 : 0 }}>
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={13} color="#facc15" fill={i <= ratingNum ? '#facc15' : 'none'} style={{ marginRight: 2 }} />
                        ))}
                      </View>
                      {/* Review text */}
                      {item.review ? (
                        <Text style={{ fontSize: 13, color: COLORS.gray[600], lineHeight: 20 }}>
                          {item.review}
                        </Text>
                      ) : null}
                    </View>
                  );
                }}
                ListFooterComponent={
                  reviewsHasMore ? (
                    <TouchableOpacity
                      onPress={() => fetchReviews(reviewFilter, reviewsPage + 1, true)}
                      disabled={reviewsLoading}
                      style={{
                        marginTop: 14, paddingVertical: 13,
                        borderRadius: 12, alignItems: 'center',
                        backgroundColor: COLORS.primary[800],
                        opacity: reviewsLoading ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                        {reviewsLoading ? 'Loading…' : 'Load More Reviews'}
                      </Text>
                    </TouchableOpacity>
                  ) : allReviews.length > 0 ? (
                    <View style={{ alignItems: 'center', paddingTop: 16 }}>
                      <Text style={{ fontSize: 11, color: COLORS.gray[400] }}>All reviews loaded</Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        </Modal>

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
              disabled={!canAddToCart}
              style={{
                flex: 2,
                backgroundColor: '#fff',
                borderWidth: 1.5,
                borderColor: canAddToCart ? COLORS.primary[800] : COLORS.gray[300],
                paddingVertical: 13,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: canAddToCart ? 1 : 0.5,
              }}
            >
              <ShoppingCart size={16} color={canAddToCart ? COLORS.primary[800] : COLORS.gray[400]} />
              <Text style={{ color: canAddToCart ? COLORS.primary[800] : COLORS.gray[400], fontWeight: '700', fontSize: 13 }}>
                Add to Cart
              </Text>
            </TouchableOpacity>

            {/* Buy Now */}
            <TouchableOpacity
              disabled={!canAddToCart}
              onPress={() => {
                if (!user) { router.push('/auth/login' as any); return; }
                if ((product.variations?.length ?? 0) > 0) {
                  const hasColors   = (product.variations || []).some((v: any) => v.name === 'Color');
                  const hasNonColor = (product.variations || []).some((v: any) => v.name !== 'Color');
                  if (hasColors && !selectedColor) { showToast('Please select a color first', 'warning'); return; }
                  if (hasNonColor && !selectedVariant) { showToast('Please select a variant first', 'warning'); return; }
                }
                const variantId = selectedVariant?.id ?? null;
                const colorId   = selectedColor?.id   ?? null;
                const params = variantId
                  ? `/checkout?buyNow=true&productId=${id}&quantity=${quantity}&variationId=${variantId}${colorId ? `&colorVariationId=${colorId}` : ''}`
                  : colorId
                    ? `/checkout?buyNow=true&productId=${id}&quantity=${quantity}&colorVariationId=${colorId}`
                    : `/checkout?buyNow=true&productId=${id}&quantity=${quantity}`;
                router.push(params as any);
              }}
              style={{
                flex: 3,
                backgroundColor: canAddToCart ? COLORS.primary[800] : COLORS.gray[300],
                paddingVertical: 13,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: canAddToCart ? 1 : 0.6,
              }}
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
