import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, RefreshCw } from 'lucide-react-native';
import { recommendationsAPI } from '../../services/api';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';

export default function RecommendationsScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const [products,   setProducts]   = useState<any[]>([]);
  const [source,     setSource]     = useState<string>('sql');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await recommendationsAPI.get({ type: 'for_you', limit: 40 });
      setProducts(res?.recommendations || []);
      setSource(res?.source || 'sql');
    } catch {
      setProducts([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Silent refresh every 30 s
  useRealtime(() => fetchData(true), 30000, true);

  const isAI = source === 'ai';

  // ── Empty state ──────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 20,
        backgroundColor: COLORS.accent[100],
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Sparkles size={32} color={COLORS.accent[500]} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.gray[800], textAlign: 'center' }}>
        Start Exploring
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.gray[400], marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
        Browse products, add to cart, and the AI will build a personalised feed just for you.
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/marketplace' as any)}
        style={{ marginTop: 24, backgroundColor: COLORS.primary[800], paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Go to Marketplace</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Product card renderer ────────────────────────────────────────────────
  const renderItem = ({ item }: { item: any }) => (
    <View style={{ flex: 1, margin: 4 }}>
      <ProductCard product={item} badge="AI Pick" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* ── Header ── */}
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 14,
        paddingBottom: 20,
        paddingHorizontal: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            {/* AI badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <View style={{
                backgroundColor: COLORS.accent[400],
                borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}>
                <Sparkles size={9} color={COLORS.primary[900]} />
                <Text style={{ color: COLORS.primary[900], fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>
                  OPENROUTER AI
                </Text>
              </View>
              {isAI && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700' }}>
                    Live
                  </Text>
                </View>
              )}
            </View>

            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>
              For You
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 3 }}>
              {user
                ? `${products.length} personalised picks · powered by AI`
                : 'Sign in for personalised picks'}
            </Text>
          </View>

          {/* Refresh button */}
          <TouchableOpacity
            onPress={() => { setRefreshing(true); fetchData(false); }}
            style={{
              width: 38, height: 38, borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ProductListSkeleton count={6} />
      ) : products.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 8 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(false); }}
              tintColor={COLORS.primary[800]}
              colors={[COLORS.primary[800]]}
            />
          }
          renderItem={renderItem}
          ListFooterComponent={
            <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Sparkles size={10} color={COLORS.gray[400]} />
                <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>
                  Recommendations refresh as you browse
                </Text>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}
