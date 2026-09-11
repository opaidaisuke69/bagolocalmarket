import React from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Star, MapPin, ShoppingCart, Package, Sparkles, Heart } from 'lucide-react-native';
import { IMAGE_BASE_URL } from '../../constants/api';
import { COLORS } from '../../constants';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { recommendationsAPI } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 8) / 2; // 2 columns with gap

interface Product {
  id: number;
  name: string;
  price: number;
  primary_image?: string;
  category_name?: string;
  rating?: number;
  sold_count?: number;
  stock?: number;
  barangay_name?: string;
  store_name?: string;
  is_available?: boolean;
}

interface ProductCardProps {
  product: Product;
  badge?: string;
  onPress?: () => void;
  disableWishlistRemove?: boolean;
  cardWidth?: number;
}

export function ProductCard({ product, badge, onPress, disableWishlistRemove, cardWidth }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const wishlisted = isInWishlist(Number(product.id));

  // PHP returns values as strings — cast explicitly before comparing
  const stockNum = Number(product.stock ?? 0);
  const isAvailable = Number(product.is_available ?? 1) !== 0; // default to available if field missing
  const inStock = stockNum > 0 || isAvailable;
  const isLowStock = stockNum > 0 && stockNum <= 5;

  const imageUri = (() => {
    const imgPath = product.primary_image 
      || (product as any).images?.find((img: any) => img.is_primary === '1')?.image_url
      || (product as any).images?.[0]?.image_url;
    if (!imgPath) return null;
    if (imgPath.startsWith('http')) return imgPath;
    // Ensure no double slash
    const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
    const path = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
    return `${base}${path}`;
  })();

  const handlePress = () => {
    if (onPress) onPress();
    else router.push(`/product/${product.id}` as any);
    // Track click for AI recommendations
    recommendationsAPI.track({ product_id: product.id, interaction_type: 'click' }).catch(() => {});
  };

  const handleAddToCart = () => {
    if (!user) { router.push('/auth/login' as any); return; }
    addToCart(product.id);
    recommendationsAPI.track({ product_id: product.id, interaction_type: 'add_to_cart' }).catch(() => {});
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.95}
      style={{
        width: cardWidth ?? CARD_WIDTH,
        marginBottom: 8,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        overflow: 'hidden',
      }}
    >
      {/* Image container — no overflow:hidden here so heart isn't clipped */}
      <View style={{ backgroundColor: '#f9fafb', height: cardWidth ?? CARD_WIDTH }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={32} color={COLORS.gray[300]} />
          </View>
        )}

        {/* Badge */}
        {badge ? (
          <View style={{ position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent[400], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, gap: 2 }}>
            <Sparkles size={8} color={COLORS.primary[900]} />
            <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.primary[900] }}>{badge}</Text>
          </View>
        ) : isLowStock ? (
          <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{product.stock} left</Text>
          </View>
        ) : null}

        {/* Wishlist heart button — always visible, red+filled when wishlisted */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            if (!user) { router.push('/auth/login' as any); return; }
            if (wishlisted && disableWishlistRemove) return;
            toggleWishlist(Number(product.id));
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 30,
            height: 30,
            backgroundColor: wishlisted ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            // Shadow so it's visible over light images
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
          }}
          activeOpacity={0.7}
        >
          <Heart
            size={15}
            color={wishlisted ? '#ef4444' : '#9ca3af'}
            fill={wishlisted ? '#ef4444' : 'none'}
          />
        </TouchableOpacity>

        {/* Out of stock overlay */}
        {!inStock && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#4b5563', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>SOLD OUT</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View className="p-2.5" style={{ gap: 4 }}>
        {/* Product name */}
        <Text className="text-xs text-gray-800 leading-4" numberOfLines={2} style={{ minHeight: 32 }}>
          {product.name}
        </Text>

        {/* Price row */}
        <View className="flex-row items-center justify-between mt-1">
          {(product as any).variant_count > 0 && (product as any).min_variant_price != null ? (
            <Text className="text-sm font-bold text-primary-800" numberOfLines={1}>
              {Number((product as any).min_variant_price).toFixed(0) === Number((product as any).max_variant_price).toFixed(0)
                ? `₱${Number((product as any).min_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
                : `₱${Number((product as any).min_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}–₱${Number((product as any).max_variant_price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
              }
            </Text>
          ) : (
            <Text className="text-sm font-bold text-primary-800">
              ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
            </Text>
          )}
        </View>

        {/* Rating + sold (Shopee-style bottom row) */}
        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center" style={{ gap: 2 }}>
            <Star size={10} color="#facc15" fill="#facc15" />
            <Text className="text-[10px] text-gray-500">
              {Number(product.rating || 0).toFixed(1)}
            </Text>
          </View>
          <Text className="text-[10px] text-gray-400">
            {product.sold_count || 0} sold
          </Text>
        </View>

        {/* Location */}
        <View className="flex-row items-center mt-0.5" style={{ gap: 3 }}>
          <MapPin size={8} color={COLORS.gray[400]} />
          <Text className="text-[9px] text-gray-400" numberOfLines={1}>
            {product.barangay_name || product.store_name || 'Bago City'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
