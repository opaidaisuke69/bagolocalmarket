import React from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Star, MapPin, ShoppingCart, Package, Sparkles, Heart } from 'lucide-react-native';
import { IMAGE_BASE_URL } from '../../constants/api';
import { COLORS } from '../../constants';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';

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
}

export function ProductCard({ product, badge, onPress, disableWishlistRemove }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const wishlisted = isInWishlist(product.id);

  const inStock = (product.stock ?? 0) > 0 || product.is_available;
  const isLowStock = (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5;

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
  };

  const handleAddToCart = () => {
    if (!user) { router.push('/auth/login' as any); return; }
    addToCart(product.id);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.95}
      style={{ width: CARD_WIDTH, marginBottom: 8 }}
      className="bg-white rounded-lg overflow-hidden border border-gray-100"
    >
      {/* Image */}
      <View className="bg-gray-50 relative" style={{ height: CARD_WIDTH }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Package size={32} color={COLORS.gray[300]} />
          </View>
        )}

        {/* Badge */}
        {badge ? (
          <View className="absolute top-2 left-2 flex-row items-center bg-accent-400 px-2 py-0.5 rounded-sm" style={{ gap: 2 }}>
            <Sparkles size={8} color={COLORS.primary[900]} />
            <Text className="text-[9px] font-bold text-primary-900">{badge}</Text>
          </View>
        ) : isLowStock ? (
          <View className="absolute top-2 left-2 bg-red-500 px-2 py-0.5 rounded-sm">
            <Text className="text-[9px] font-bold text-white">{product.stock} left</Text>
          </View>
        ) : null}

        {/* Wishlist button */}
        <View className="absolute top-2 right-2">
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              if (!user) { router.push('/auth/login' as any); return; }
              // If already wishlisted and on wishlist page, don't remove
              if (wishlisted && disableWishlistRemove) return;
              toggleWishlist(product.id);
            }}
            style={{ width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <Heart size={14} color={wishlisted ? '#ef4444' : COLORS.gray[400]} fill={wishlisted ? '#ef4444' : 'none'} />
          </TouchableOpacity>
        </View>

        {/* Out of stock overlay */}
        {!inStock && (
          <View className="absolute inset-0 bg-white/70 items-center justify-center">
            <Text className="text-xs font-bold text-gray-600 bg-white px-3 py-1 rounded">SOLD OUT</Text>
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
          <Text className="text-sm font-bold text-primary-800">
            ₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
          </Text>
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
