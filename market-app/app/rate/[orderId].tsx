import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star, Package, CheckCircle, Edit3, Send } from 'lucide-react-native';
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

const RATING_CONFIG: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: 'Terrible',  color: '#ef4444', emoji: '😞' },
  2: { label: 'Poor',      color: '#f97316', emoji: '😕' },
  3: { label: 'Average',   color: '#f59e0b', emoji: '😐' },
  4: { label: 'Good',      color: '#22c55e', emoji: '😊' },
  5: { label: 'Excellent', color: '#10b981', emoji: '🤩' },
};

function StarRow({ productId, rating, editable, onChange }: {
  productId: number;
  rating: number;
  editable: boolean;
  onChange: (productId: number, star: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => editable && onChange(productId, star)}
          activeOpacity={editable ? 0.7 : 1}
          style={{ padding: 4 }}
        >
          <Star
            size={36}
            color={star <= rating ? '#facc15' : '#e5e7eb'}
            fill={star <= rating ? '#facc15' : 'none'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

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
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(!isEditMode);

  const [ratings, setRatings]             = useState<Record<number, number>>({});
  const [comments, setComments]           = useState<Record<number, string>>({});
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
        const token = await AsyncStorage.getItem('token');

        for (const item of (data.order?.items || [])) {
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

  const handleSubmit = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('token');
      for (const item of order.items) {
        const productId = item.product_id;
        const rating    = ratings[productId] || 5;
        const comment   = comments[productId] || '';
        const existing  = existingReviews[productId];

        await fetch(`${API_BASE_URL}/products/review.php`, {
          method: existing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            product_id: productId,
            order_id:   orderId,
            rating,
            comment,
            review_id:  existing?.id || undefined,
          }),
        });
      }
      setSubmitted(true);
      showToast(isEditMode ? 'Review updated!' : 'Thank you for your review!', 'success');
      setTimeout(() => router.back(), 1400);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <Skeleton width={140} height={18} />
          </View>
        </View>
        <View style={{ padding: 16, gap: 14 }}>
          {[1, 2].map(i => (
            <View key={i} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={60} height={60} borderRadius={10} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="40%" height={12} />
                </View>
              </View>
              <Skeleton width="60%" height={36} />
              <Skeleton width="100%" height={80} borderRadius={10} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
        <Package size={52} color={COLORS.gray[300]} />
        <Text style={{ color: COLORS.gray[500], marginTop: 16, fontSize: 14 }}>Order not found</Text>
      </View>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <CheckCircle size={44} color="#16a34a" fill="#bbf7d0" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#15803d', marginBottom: 8 }}>Review Submitted!</Text>
        <Text style={{ fontSize: 14, color: '#4ade80', textAlign: 'center' }}>
          Thank you for sharing your feedback.
        </Text>
      </View>
    );
  }

  const hasExistingReviews = Object.keys(existingReviews).length > 0;
  const items = order.items || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>

      {/* ── Header ── */}
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 8,
        paddingBottom: 18,
        paddingHorizontal: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowLeft size={18} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {hasExistingReviews && !isEditing ? 'My Review' : 'Rate Products'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>
                Order #{order.order_number}
              </Text>
            </View>
          </View>
          {hasExistingReviews && !isEditing && (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}
            >
              <Edit3 size={13} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress dots */}
        {!hasExistingReviews && items.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 }}>
            {items.map((_: any, i: number) => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' }} />
            ))}
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100 }}
      >
        {items.map((item: any, idx: number) => {
          const imageUri     = buildImageUrl(item.product_image);
          const productId    = Number(item.product_id);
          const currentRating = ratings[productId] ?? 5;
          const ratingInfo   = RATING_CONFIG[currentRating];
          const existing     = existingReviews[productId];

          return (
            <View
              key={productId}
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              {/* Card top accent bar */}
              <View style={{ height: 4, backgroundColor: ratingInfo.color }} />

              <View style={{ padding: 18 }}>
                {/* Product row */}
                <View style={{ flexDirection: 'row', gap: 14, marginBottom: 20 }}>
                  <View style={{
                    width: 68, height: 68,
                    borderRadius: 12,
                    backgroundColor: '#f1f5f9',
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                  }}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={24} color={COLORS.gray[300]} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 20 }} numberOfLines={2}>
                      {item.product_name}
                    </Text>
                    {item.variation_label ? (
                      <Text style={{ fontSize: 11, color: COLORS.primary[700], fontWeight: '600', marginTop: 3 }}>
                        {item.variation_label}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                      Qty: {item.quantity}  ·  ₱{Number(item.price).toLocaleString('en-PH')}
                    </Text>
                    {item.store_name && (
                      <Text style={{ fontSize: 11, color: COLORS.primary[800], marginTop: 2, fontWeight: '600' }}>
                        {item.store_name}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Rating section */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  {/* Emoji + label */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: `${ratingInfo.color}18`,
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 24, marginBottom: 14,
                  }}>
                    <Text style={{ fontSize: 18 }}>{ratingInfo.emoji}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: ratingInfo.color }}>
                      {ratingInfo.label}
                    </Text>
                  </View>

                  {/* Stars */}
                  <StarRow
                    productId={productId}
                    rating={currentRating}
                    editable={isEditing}
                    onChange={(pid, star) => setRatings(prev => ({ ...prev, [pid]: star }))}
                  />

                  {/* Tap hint */}
                  {isEditing && (
                    <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
                      Tap a star to rate
                    </Text>
                  )}
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 14 }} />

                {/* Comment */}
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Your Comment
                  </Text>
                  {isEditing ? (
                    <TextInput
                      value={comments[productId] || ''}
                      onChangeText={(text) => setComments(prev => ({ ...prev, [productId]: text }))}
                      placeholder="What did you think about this product? (optional)"
                      placeholderTextColor="#cbd5e1"
                      multiline
                      numberOfLines={3}
                      style={{
                        backgroundColor: '#f8fafc',
                        borderWidth: 1.5,
                        borderColor: '#e2e8f0',
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 13,
                        color: '#0f172a',
                        textAlignVertical: 'top',
                        minHeight: 90,
                        lineHeight: 20,
                      }}
                    />
                  ) : (
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 13, color: comments[productId] ? '#334155' : '#cbd5e1', lineHeight: 20, fontStyle: comments[productId] ? 'normal' : 'italic' }}>
                        {comments[productId] || 'No comment added'}
                      </Text>
                      {existing?.created_at && (
                        <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 10 }}>
                          Reviewed {new Date(existing.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Overall summary */}
        {items.length > 1 && isEditing && (
          <View style={{ backgroundColor: COLORS.primary[800], borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Overall average</Text>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 }}>
                {(Object.values(ratings).reduce((a, b) => a + b, 0) / Math.max(Object.values(ratings).length, 1)).toFixed(1)}
                <Text style={{ fontSize: 13, fontWeight: '400' }}> / 5.0</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3, 4, 5].map(s => {
                const avg = Object.values(ratings).reduce((a, b) => a + b, 0) / Math.max(Object.values(ratings).length, 1);
                return (
                  <Star key={s} size={18} color={s <= Math.round(avg) ? '#facc15' : 'rgba(255,255,255,0.2)'} fill={s <= Math.round(avg) ? '#facc15' : 'none'} />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Submit button ── */}
      {isEditing && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1, borderTopColor: '#f1f5f9',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
        }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? COLORS.gray[300] : COLORS.primary[800],
              paddingVertical: 15,
              borderRadius: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Send size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 }}>
                  {hasExistingReviews ? 'Update Review' : 'Submit Review'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
