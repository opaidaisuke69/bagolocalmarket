import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Package, ShoppingBag, Check, AlertCircle } from 'lucide-react-native';
import { notificationsAPI } from '../../services/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useRealtime } from '../../hooks/useRealtime';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!user) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const data = await notificationsAPI.list({ limit: 50 });
      setNotifications(data.notifications || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Real-time polling
  useRealtime(
    useCallback(async () => {
      if (!user) return;
      try {
        const data = await notificationsAPI.list({ limit: 50 });
        setNotifications(data.notifications || []);
      } catch {}
    }, [user]),
    1500,
    !!user
  );

  const markAsRead = async (id: number) => {
    // Optimistic
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    try {
      await notificationsAPI.markRead({ id });
    } catch {
      fetchNotifications();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={18} color={COLORS.primary[800]} />;
      case 'product': return <Package size={18} color="#10b981" />;
      default: return <Bell size={18} color={COLORS.gray[500]} />;
    }
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center" edges={['top']}>
        <Bell size={48} color={COLORS.gray[300]} />
        <Text className="text-gray-500 font-medium mt-4">Login to view notifications</Text>
      </SafeAreaView>
    );
  }

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => markAsRead(item.id)}
      className={`mx-4 mb-2 p-4 rounded-2xl border ${item.is_read ? 'bg-white border-gray-100' : 'bg-primary-50 border-primary-100'}`}
      activeOpacity={0.8}
    >
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
          {getIcon(item.type)}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
            {item.title || item.message}
          </Text>
          {item.body && (
            <Text className="text-xs text-gray-500 mt-1" numberOfLines={2}>{item.body}</Text>
          )}
          <Text className="text-[10px] text-gray-400 mt-2">{item.created_at}</Text>
        </View>
        {!item.is_read && (
          <View className="w-2 h-2 rounded-full bg-primary-800 mt-2" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ProgressBar visible={loading} />

      <View className="px-4 pt-4 pb-3">
        <Text className="text-xl font-bold text-gray-900">Notifications</Text>
      </View>

      {loading ? (
        <View className="px-4" style={{ gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} className="flex-row bg-white rounded-2xl p-4 border border-gray-100" style={{ gap: 12 }}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="80%" height={14} />
                <Skeleton width="50%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Bell size={48} color={COLORS.gray[300]} />
          <Text className="text-gray-500 text-sm font-medium mt-4">No notifications</Text>
          <Text className="text-gray-400 text-xs mt-1 text-center">
            You'll see order updates and alerts here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor={COLORS.primary[800]} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 20 }}
        />
      )}
    </SafeAreaView>
  );
}
