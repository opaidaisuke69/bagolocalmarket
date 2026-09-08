import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, RefreshCw, Eye, ShoppingCart, Tag, MapPin } from 'lucide-react-native';
import { recommendationsAPI } from '../../services/api';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';

// ─────────────────────────────────────────────────────────────────────────────
// Sections shown in the feed — each backed by its own AI signal
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    key: 'recently_viewed',
    label: 'Because You Viewed',
    subtitle: 'Based on products you recently browsed',
    icon: Eye,
    color: COLORS.primary[800],
    recType: 'because_viewed',
  },
  {
    key: 'cart_based',
    label: 'Goes Well With Your Cart',
    subtitle: 'Items that pair with what you saved',
    icon: ShoppingCart,
    color: '#f59e0b',
    recType: 'cart_picks',
  },
  {
    key: 'category_based',
    label: 'More From Your Interests',
    subtitle: 'Based on categories you explore',
    icon: Tag,
    color: COLORS.accent[500],
    recType: 'for_you',
  },
  {
    key: 'near_me',
    label: 'Near You',
    subtitle: 'Popular in your barangay',
    icon: MapPin,
    color: '#10b981',
    recType: 'trending_barangay',
  },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];
type SectionData = Record<SectionKey, any[]>;

const EMPTY_DATA: SectionData = {
  recently_viewed: [],
  cart_based: [],
  category_based: [],
  near_me: [],
};

// ─────────────────────────────────────────────────────────────────────────────
export default function RecommendationsScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const [data,       setData]       = useState<SectionData>(EMPTY_DATA);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch all section data in parallel ──────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const results = await Promise.allSettled(
        SECTIONS.map(s => recommendationsAPI.get({ type: s.recType, limit: 10 }))
      );
      const next = { ...EMPTY_DATA };
      SECTIONS.forEach((s, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          next[s.key] = r.value?.recommendations || [];
        }
      });
      setData(next);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent refresh every 30 s
  useRealtime(() => fetchAll(true), 30000, true);

  const totalCount = SECTIONS.reduce((s, sec) => s + (data[sec.key]?.length || 0), 0);

  // ── Section header ───────────────────────────────────────────────────────
  const SectionHeader = ({ section }: { section: typeof SECTIONS[number] }) => (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, gap: 8,
    }}>
      <View style={{
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: section.color + '18',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <section.icon size={15} color={section.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.gray[900] }}>
          {section.label}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.gray[400], marginTop: 1 }}>
          {section.subtitle}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push('/marketplace' as any)}
        style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.gray[100] }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.gray[500] }}>See all</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Horizontal product row ───────────────────────────────────────────────
  const CARD_W = 158;
  const CARD_GAP = 10;

  const HorizontalRow = ({ items, emptyText }: { items: any[]; emptyText: string }) => {
    if (items.length === 0) {
      return (
        <View style={{
          marginHorizontal: 16, paddingVertical: 20, paddingHorizontal: 16,
          backgroundColor: '#f3f4f6', borderRadius: 12,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: COLORS.gray[400], textAlign: 'center' }}>{emptyText}</Text>
          <TouchableOpacity
            onPress={() => router.push('/marketplace' as any)}
            style={{ marginTop: 10, backgroundColor: COLORS.primary[800], paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>Browse Marketplace</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
      >
        {items.map((product, index) => (
          <View
            key={String(product.id)}
            style={{
              width: CARD_W,
              marginRight: index < items.length - 1 ? CARD_GAP : 0,
            }}
          >
            <ProductCard product={product} cardWidth={CARD_W} />
          </View>
        ))}
      </ScrollView>
    );
  };

  // ── Empty state (no data at all) ─────────────────────────────────────────
  const renderGlobalEmpty = () => (
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
        style={{
          marginTop: 24, backgroundColor: COLORS.primary[800],
          paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Go to Marketplace</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View style={{
                backgroundColor: COLORS.accent[400],
                borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}>
                <Sparkles size={9} color={COLORS.primary[900]} />
                <Text style={{ color: COLORS.primary[900], fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>
                  AI POWERED
                </Text>
              </View>
            </View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>
              For You
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
              {user
                ? `${totalCount} personalised picks · updates live`
                : 'Sign in for personalised picks'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => { setRefreshing(true); fetchAll(false); }}
            style={{
              width: 38, height: 38, borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={15} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Signal chips */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <View key={s.key} style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
            }}>
              <s.icon size={10} color="rgba(255,255,255,0.7)" />
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                {s.label}
              </Text>
              {data[s.key].length > 0 && (
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: s.color,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 8, color: '#fff', fontWeight: '900' }}>
                    {data[s.key].length}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ProductListSkeleton count={6} />
      ) : totalCount === 0 ? (
        renderGlobalEmpty()
      ) : (
        <FlatList
          data={SECTIONS}
          keyExtractor={item => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll(false); }}
              tintColor={COLORS.primary[800]}
              colors={[COLORS.primary[800]]}
            />
          }
          renderItem={({ item: section }) => (
            <View>
              <SectionHeader section={section} />
              <HorizontalRow
                items={data[section.key]}
                emptyText={
                  section.key === 'recently_viewed'
                    ? 'Browse some products to see suggestions here.'
                    : section.key === 'cart_based'
                    ? 'Add items to your cart to get paired suggestions.'
                    : section.key === 'category_based'
                    ? 'Explore categories to unlock personalised picks.'
                    : 'Set a delivery address to see local favourites.'
                }
              />
            </View>
          )}
          ListFooterComponent={
            <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 8 }}>
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
