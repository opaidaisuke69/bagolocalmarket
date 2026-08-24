import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
  LogIn,
  Wallet,
  Truck,
  PackageCheck,
  Star,
  ShoppingCart,
  ClipboardList,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ordersAPI } from '../../services/api';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, title, onPress, danger }: MenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
      activeOpacity={0.7}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: danger ? '#ef4444' : COLORS.gray[900] }}>
        {title}
      </Text>
      <ChevronRight size={16} color={COLORS.gray[400]} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { count } = useCart();
  const insets = useSafeAreaInsets();

  // Order counts per status
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  const fetchOrderCounts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await ordersAPI.list({ limit: 200 });
      const orders = data.orders || [];
      const counts: Record<string, number> = {};
      orders.forEach((o: any) => {
        // For "delivered" status, only count orders that have NOT been rated
        if (o.status === 'delivered' && o.is_rated) return;
        counts[o.status] = (counts[o.status] || 0) + 1;
      });
      setOrderCounts(counts);
    } catch {}
  }, [user]);

  useEffect(() => { fetchOrderCounts(); }, [fetchOrderCounts]);

  // Real-time poll order counts every 1.5s
  useRealtime(fetchOrderCounts, 1500, !!user);

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 8, paddingBottom: 40, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
            <User size={28} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Welcome to Bago Marketplace</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>Login to access your account</Text>
        </View>
        <View style={{ alignItems: 'center', marginTop: -20 }}>
          <TouchableOpacity
            onPress={() => router.push('/auth/login' as any)}
            style={{ backgroundColor: COLORS.accent[400], paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <LogIn size={16} color={COLORS.primary[900]} />
            <Text style={{ color: COLORS.primary[900], fontWeight: '700', fontSize: 13 }}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/auth/register' as any)} style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: COLORS.primary[800], fontWeight: '500' }}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* ── Profile Header ── */}
        <View style={{ backgroundColor: COLORS.primary[800], paddingTop: insets.top + 12, paddingBottom: 24, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              {/* Avatar */}
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                  {user.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
              {/* Name, email, status */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{user.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{user.email}</Text>
                <View style={{ backgroundColor: COLORS.accent[400], alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.primary[900], textTransform: 'capitalize' }}>{user.role}</Text>
                </View>
              </View>
            </View>
            {/* Cart icon */}
            <TouchableOpacity onPress={() => router.push('/cart' as any)} style={{ position: 'relative' }}>
              <ShoppingCart size={22} color="#fff" />
              {count > 0 && (
                <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.accent[400], borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: COLORS.primary[900] }}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── My Purchases ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.gray[900] }}>My Purchases</Text>
            <TouchableOpacity onPress={() => router.push('/purchases?tab=all' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: COLORS.primary[800], fontWeight: '500' }}>View All</Text>
              <ChevronRight size={12} color={COLORS.primary[800]} />
            </TouchableOpacity>
          </View>

          {/* Purchase status tabs */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <TouchableOpacity onPress={() => router.push('/purchases?tab=pending' as any)} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Wallet size={18} color={COLORS.primary[800]} />
                </View>
                {(orderCounts['pending'] || 0) > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>{orderCounts['pending']}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: COLORS.gray[600], textAlign: 'center' }}>To Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/purchases?tab=confirmed' as any)} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <ClipboardList size={18} color={COLORS.primary[800]} />
                </View>
                {(orderCounts['confirmed'] || 0) > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>{orderCounts['confirmed']}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: COLORS.gray[600], textAlign: 'center' }}>To Ship</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/purchases?tab=shipped' as any)} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Truck size={18} color={COLORS.primary[800]} />
                </View>
                {(orderCounts['shipped'] || 0) > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>{orderCounts['shipped']}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: COLORS.gray[600], textAlign: 'center' }}>To Receive</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/purchases?tab=delivered' as any)} style={{ alignItems: 'center', flex: 1 }}>
              <View style={{ position: 'relative' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                  <Star size={18} color={COLORS.primary[800]} />
                </View>
                {(orderCounts['delivered'] || 0) > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>{orderCounts['delivered']}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: COLORS.gray[600], textAlign: 'center' }}>To Rate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Menu Items ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8, borderRadius: 0 }}>
          <MenuItem
            icon={<MapPin size={16} color="#10b981" />}
            title="Addresses"
            onPress={() => {}}
          />
          <View style={{ height: 1, backgroundColor: '#f3f4f6', marginLeft: 62 }} />
          <MenuItem
            icon={<Settings size={16} color={COLORS.gray[600]} />}
            title="Settings"
            onPress={() => {}}
          />
        </View>

        {/* ── Logout ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 8 }}>
          <MenuItem
            icon={<LogOut size={16} color="#ef4444" />}
            title="Logout"
            onPress={handleLogout}
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}
