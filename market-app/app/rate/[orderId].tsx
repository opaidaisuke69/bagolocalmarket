import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  Package,
  Edit3,
} from 'lucide-react-native';
import { ordersAPI } from '../../services/api';
import { IMAGE_BASE_URL, API_BASE_URL } from '../../constants/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL.slice(0, -1) : IMAGE_BASE_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

const RATING_LABELS = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'];

export default function RateOrderScreen() {
  const { orderId, edit } = useLocalSearchParams<{ orderId: string; edit?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();

  const isEditMode = edit === 'true';

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(!isEditMode); // Start in edit mode for new reviews

  // Rating state per product
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [existingReviews, setExistingReviews] = useState<Record<number, any>>({});

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const data = await ordersAPI.detail(Number(orderId));
        setOrder(data.order);

        const initRatings: Record<number, number> = {};
        const initComments: Record<number, string> = {};
        const existing: Record<number, any> = {};

        // Check if reviews already exist for this order's items
        const token = await AsyncStorage.getItem('token');

        for (const item of (data.order?.items || [])) {
          // Try to fetch existing review for this product by the current user
          try {
            const res = await fetch(`${API_BASE_URL}/products/detail.php?id=${item.product_id}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            const productData = await res.json();
            const myReview = (productData.product?.reviews || []).find(
              (r: any) => Number(r.user_id) === Number(user?.id) && Number(r.order_id) === Number(orderId)
            );
            if (myReview) {
              existing[item.product_id] = myReview;
              initRatings[item.product_id] = Number(myReview.rating);
              initComments[item.product_id] = myReview.review || '';
            } else {
              initRatings[item.product_id] = 5;
              initComments[item.product_id] = '';
            }
          } catch {
            initRatings[item.product_id] = 5;
            initComments[item.product_id] = '';
          }
        }

        setRatings(initRatings);
        setComments(initComments);
        setExistingReviews(existing);
      } catch {
        showToast('Failed to load order', 'error');
      } finally {
        setLoading(false);
      }
    };
    if (orderId) fetchOrder();
  }, [orderId]);

  const setRating = (productId: number, rating: number) => {
    if (!isEditing) return;
    setRatings(prev => ({ ...prev, [productId]: rating }));
  };

  const setComment = (productId: number, comment: string) => {
    if (!isEditing) return;
    setComments(prev => ({ ...prev, [productId]: comment }));
  };

  const handleSubmit = async () => {
    if (!order) return;
    setSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('token');

      for (const item of order.items) {
        const productId = item.product_id;
        const rating = ratings[productId] || 5;
        const comment = comments[productId] || '';
        const existing = existingReviews[productId];

        // If editing, use update endpoint; if new, use create
        const body = JSON.stringify({
          product_id: productId,
          order_id: orderId,
          rating,
          comment,
          review_id: existing?.id || undefined,
        });

        await fetch(`${API_BASE_URL}/products/review.php`, {
          method: existing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body,
        });
      }

      showToast(isEditMode ? 'Review updated!' : 'Review submitted! Thank you.', 'success');
      router.back();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <Skeleton width={120} height={18} />
          </View>
        </View>
        <View style={{ padding: 16, gap: 16 }}>
          <Skeleton width="100%" height={100} borderRadius={12} />
          <Skeleton width="100%" height={100} borderRadius={12} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Package size={48} color={COLORS.gray[300]} />
        <Text style={{ color: COLORS.gray[500], marginTop: 16 }}>Order not found</Text>
      </View>
    );
  }

  const hasExistingReviews = Object.keys(existingReviews).length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
              <ArrowLeft size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {hasExistingReviews && !isEditing ? 'My Review' : 'Rate Products'}
            </Text>
          </View>
          {/* Edit toggle button */}
          {hasExistingReviews && !isEditing && (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            >
              <Edit3 size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {(order.items || []).map((item: any) => {
          const imageUri = buildImageUrl(item.product_image);
          const productId = item.product_id;
          const currentRating = ratings[productId] || 5;
          const existing = existingReviews[productId];

          return (
            <View key={productId} style={{ backgroundColor: '#fff', marginTop: 8, padding: 16 }}>
              {/* Product info */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f8fafc', overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' }}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={20} color={COLORS.gray[300]} />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.gray[900] }} numberOfLines={2}>{item.product_name}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>x{item.quantity}</Text>
                </View>
              </View>

              {/* Star Rating */}
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 10 }}>Product Quality</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setRating(productId, star)} disabled={!isEditing}>
                      <Star
                        size={34}
                        color={star <= currentRating ? '#facc15' : COLORS.gray[300]}
                        fill={star <= currentRating ? '#facc15' : 'none'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: currentRating >= 4 ? '#15803d' : currentRating >= 3 ? '#f59e0b' : '#ef4444', fontWeight: '600', marginTop: 8 }}>
                  {RATING_LABELS[currentRating]}
                </Text>
              </View>

              {/* Comment */}
              {isEditing ? (
                <TextInput
                  value={comments[productId] || ''}
                  onChangeText={(text) => setComment(productId, text)}
                  placeholder="Share your experience with this product..."
                  placeholderTextColor={COLORS.gray[400]}
                  multiline
                  numberOfLines={3}
                  style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, color: COLORS.gray[900], textAlignVertical: 'top', minHeight: 80 }}
                />
              ) : (
                <View style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 }}>
                  <Text style={{ fontSize: 13, color: comments[productId] ? COLORS.gray[700] : COLORS.gray[400], lineHeight: 18 }}>
                    {comments[productId] || 'No comment'}
                  </Text>
                  {existing?.created_at && (
                    <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 8 }}>
                      Reviewed on {new Date(existing.created_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom button */}
      {isEditing && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{ backgroundColor: COLORS.primary[800], paddingVertical: 14, borderRadius: 10, alignItems: 'center', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {hasExistingReviews ? 'Update Review' : 'Submit Review'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
