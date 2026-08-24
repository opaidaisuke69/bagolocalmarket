import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search as SearchIcon, X, Clock, TrendingUp } from 'lucide-react-native';
import { searchAPI, productsAPI } from '../services/api';
import { ProductCard } from '../components/marketplace/ProductCard';
import { ProductListSkeleton } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { COLORS } from '../constants';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  // Load search history
  useEffect(() => {
    searchAPI.history().then(data => {
      setHistory(data.history || []);
    }).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const search = async () => {
      setLoading(true);
      setHasSearched(true);
      try {
        const data = await productsAPI.list({ search: debouncedQuery, limit: 20 });
        setResults(data.products || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    search();
  }, [debouncedQuery]);

  const handleHistoryPress = (term: string) => {
    setQuery(term);
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Search header */}
      <View className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center" style={{ gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <ArrowLeft size={20} color={COLORS.gray[700]} />
        </TouchableOpacity>
        <View className="flex-1 relative">
          <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
            <SearchIcon size={16} color={COLORS.gray[400]} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products, brands..."
            placeholderTextColor={COLORS.gray[400]}
            autoFocus
            className="bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              className="absolute right-3 top-0 bottom-0 justify-center"
            >
              <X size={15} color={COLORS.gray[400]} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {!hasSearched ? (
        <View className="px-4 mt-4">
          {history.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-500 uppercase mb-3">
                Recent Searches
              </Text>
              {history.map((term, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleHistoryPress(term)}
                  className="flex-row items-center py-3 border-b border-gray-50"
                  style={{ gap: 10 }}
                >
                  <Clock size={14} color={COLORS.gray[400]} />
                  <Text className="text-sm text-gray-700 flex-1">{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View className="mt-6">
            <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
              <TrendingUp size={14} color={COLORS.primary[800]} />
              <Text className="text-xs font-semibold text-gray-500 uppercase">
                Popular
              </Text>
            </View>
            {['Fresh Vegetables', 'Electronics', 'Handmade Crafts', 'School Supplies'].map((term) => (
              <TouchableOpacity
                key={term}
                onPress={() => handleHistoryPress(term)}
                className="flex-row items-center py-3 border-b border-gray-50"
                style={{ gap: 10 }}
              >
                <SearchIcon size={14} color={COLORS.gray[400]} />
                <Text className="text-sm text-gray-700">{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : loading ? (
        <View className="mt-4">
          <ProductListSkeleton count={6} />
        </View>
      ) : results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <SearchIcon size={48} color={COLORS.gray[300]} />
          <Text className="text-gray-500 text-sm font-medium mt-4">No results found</Text>
          <Text className="text-gray-400 text-xs mt-1 text-center">
            Try different keywords
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductCard product={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 20 }}
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
  );
}
