import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  User, MapPin, LogOut, ChevronRight, LogIn,
  Wallet, Truck, Star, ShoppingCart, ClipboardList,
  Plus, Trash2, Edit3, Check, Camera, Settings,
  Package, Heart, Bell, Shield,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ordersAPI, addressesAPI, profileAPI } from '../../services/api';
import { useRealtime } from '../../hooks/useRealtime';
import { COLORS } from '../../constants';
import { IMAGE_BASE_URL } from '../../constants/api';

const { width: SCREEN_W } = Dimensions.get('window');
const API_BASE = require('../../constants/api').API_BASE_URL;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Address {
  id: number;
  recipient_name: string;
  contact_number: string;
  barangay_id: number;
  barangay_name?: string;
  street_address: string;
  landmark?: string;
  delivery_notes?: string;
  is_default: number;
  latitude?: number;
}
interface Barangay { id: number; name: string; shipping_fee: number; }

// ── Stat Pill ──────────────────────────────────────────────────────────────────
function StatPill({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>{label}</Text>
    </View>
  );
}

// ── Order Status Button ────────────────────────────────────────────────────────
function OrderStatusBtn({ tab, icon: Icon, label, count, onPress }: {
  tab: string; icon: any; label: string; count: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', flex: 1 }} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24,
          backgroundColor: COLORS.primary[50],
          alignItems: 'center', justifyContent: 'center', marginBottom: 6,
        }}>
          <Icon size={20} color={COLORS.primary[800]} />
        </View>
        {count > 0 && (
          <View style={{
            position: 'absolute', top: -4, right: -8,
            backgroundColor: '#ef4444', borderRadius: 10,
            minWidth: 18, height: 18, alignItems: 'center',
            justifyContent: 'center', paddingHorizontal: 4,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 10, color: '#6b7280', fontWeight: '500', textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Menu Row ───────────────────────────────────────────────────────────────────
function MenuRow({
  icon, iconBg, label, subtitle, onPress, danger = false, rightNode,
}: {
  icon: React.ReactNode; iconBg: string; label: string;
  subtitle?: string; onPress: () => void; danger?: boolean; rightNode?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 16,
      }}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: iconBg, alignItems: 'center',
        justifyContent: 'center', marginRight: 13,
      }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: danger ? '#ef4444' : '#111827' }}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{subtitle}</Text>
        ) : null}
      </View>
      {rightNode ?? <ChevronRight size={16} color={danger ? '#fca5a5' : COLORS.gray[300]} />}
    </TouchableOpacity>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const router  = useRouter();
  const { user, logout } = useAuth();
  const { count } = useCart();
  const insets  = useSafeAreaInsets();

  // ── order counts ─────────────────────────────────────────────────────────
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrderCounts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await ordersAPI.list({ limit: 200 });
      const counts: Record<string, number> = {};
      const all: any[] = data.orders || [];
      all.forEach((o: any) => {
        if (o.status === 'delivered' && o.is_rated) return;
        counts[o.status] = (counts[o.status] || 0) + 1;
      });
      setOrderCounts(counts);
      setTotalOrders(all.length);
    } catch {}
  }, [user]);

  useEffect(() => { fetchOrderCounts(); }, [fetchOrderCounts]);
  useRealtime(fetchOrderCounts, 3000, !!user);

  // ── addresses ─────────────────────────────────────────────────────────────
  const [addresses,   setAddresses]   = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddrLoading(true);
    try {
      const res = await addressesAPI.list();
      setAddresses(res.addresses || []);
    } catch {}
    setAddrLoading(false);
  }, [user]);

  useEffect(() => { if (user) loadAddresses(); }, [user]);

  useFocusEffect(useCallback(() => {
    if (user) { loadAddresses(); fetchOrderCounts(); }
  }, [user, loadAddresses, fetchOrderCounts]));

  // ── profile photo ─────────────────────────────────────────────────────────
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.profile_image) setProfileImage(user.profile_image);
  }, [user?.profile_image]);

  const getAvatarUrl = () => {
    const img = profileImage || user?.profile_image;
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return `${IMAGE_BASE_URL}${img}`;
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Guest view ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <View style={{
          backgroundColor: COLORS.primary[800],
          paddingTop: insets.top + 20,
          paddingBottom: 60,
          alignItems: 'center', paddingHorizontal: 32,
        }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
            marginBottom: 16,
          }}>
            <User size={36} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
            Welcome to Bago Shop Express
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
            Sign in to access your profile, track orders, and shop locally
          </Text>
        </View>

        {/* CTA card */}
        <View style={{
          marginHorizontal: 20, marginTop: -28,
          backgroundColor: '#fff', borderRadius: 20, padding: 24,
          shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08, shadowRadius: 16, elevation: 8,
        }}>
          <TouchableOpacity
            onPress={() => router.push('/auth/login' as any)}
            style={{
              backgroundColor: COLORS.primary[800],
              paddingVertical: 15, borderRadius: 14,
              alignItems: 'center', flexDirection: 'row',
              justifyContent: 'center', gap: 8,
            }}
          >
            <LogIn size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Login to Your Account</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ fontSize: 12, color: '#9ca3af', fontWeight: '500' }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>

          <TouchableOpacity
            onPress={() => router.push('/auth/register' as any)}
            style={{
              borderWidth: 1.5, borderColor: COLORS.primary[800],
              paddingVertical: 14, borderRadius: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: COLORS.primary[800], fontWeight: '700', fontSize: 15 }}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Feature bullets */}
        <View style={{ marginHorizontal: 20, marginTop: 20, gap: 12 }}>
          {[
            { icon: Package, label: 'Track your orders in real time' },
            { icon: Heart, label: 'Save your favorite products' },
            { icon: MapPin, label: 'Manage delivery addresses' },
          ].map(({ icon: Icon, label }) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primary[50], alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={COLORS.primary[800]} />
              </View>
              <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Avatar initials fallback ───────────────────────────────────────────────
  const avatarUrl = getAvatarUrl();
  const initials  = (user.name || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const defaultAddr = addresses.find(a => a.is_default == 1);

  // ── Authenticated view ─────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Hero header ── */}
        <View style={{
          backgroundColor: COLORS.primary[800],
          paddingTop: insets.top + 12,
          paddingBottom: 32,
        }}>
          {/* Top bar */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', paddingHorizontal: 18, marginBottom: 20,
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>
              MY ACCOUNT
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/cart' as any)}
              style={{ position: 'relative' }}
            >
              <ShoppingCart size={22} color="#fff" />
              {count > 0 && (
                <View style={{
                  position: 'absolute', top: -6, right: -6,
                  backgroundColor: COLORS.accent[400], borderRadius: 9,
                  minWidth: 18, height: 18, alignItems: 'center',
                  justifyContent: 'center', paddingHorizontal: 3,
                }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: COLORS.primary[900] }}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Avatar + info */}
          <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
            {/* Avatar container */}
            <View style={{ position: 'relative', marginBottom: 14 }}>
              <View style={{
                width: 90, height: 90, borderRadius: 45,
                borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
                backgroundColor: COLORS.primary[700],
                overflow: 'hidden',
              }}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{initials}</Text>
                  </View>
                )}
              </View>
              {/* Camera badge */}
              <TouchableOpacity
                onPress={() => router.push('/settings' as any)}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: COLORS.accent[400],
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: COLORS.primary[800],
                }}
              >
                <Camera size={13} color={COLORS.primary[900]} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
              {user.name || user.full_name}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 }}>
              {user.email}
            </Text>
            {(user.contact_number || user.phone) && (
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                {user.contact_number || user.phone}
              </Text>
            )}

            {/* Role badge */}
            <View style={{
              backgroundColor: COLORS.accent[400],
              paddingHorizontal: 12, paddingVertical: 4,
              borderRadius: 20, marginTop: 10,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.primary[900], textTransform: 'uppercase', letterSpacing: 1 }}>
                {user.role}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={{
            flexDirection: 'row', marginTop: 20, marginHorizontal: 20,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
          }}>
            <StatPill value={totalOrders} label="Orders" />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <StatPill value={addresses.length} label="Addresses" />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <StatPill value={orderCounts['delivered'] ?? 0} label="Completed" />
          </View>
        </View>

        {/* ── My Purchases ── */}
        <View style={{
          backgroundColor: '#fff', marginTop: 10,
          marginHorizontal: 0,
        }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>My Purchases</Text>
            <TouchableOpacity
              onPress={() => router.push('/purchases?tab=all' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Text style={{ fontSize: 12, color: COLORS.primary[800], fontWeight: '600' }}>View All</Text>
              <ChevronRight size={13} color={COLORS.primary[800]} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 16, gap: 4 }}>
            {[
              { tab: 'pending',   icon: Wallet,       label: 'To Pay'     },
              { tab: 'confirmed', icon: ClipboardList, label: 'To Ship'    },
              { tab: 'shipped',   icon: Truck,        label: 'To Receive'  },
              { tab: 'delivered', icon: Star,         label: 'To Rate'     },
            ].map(({ tab, icon, label }) => (
              <OrderStatusBtn
                key={tab} tab={tab} icon={icon} label={label}
                count={orderCounts[tab] || 0}
                onPress={() => router.push(`/purchases?tab=${tab}` as any)}
              />
            ))}
          </View>
        </View>

        {/* ── Default Address Card ── */}
        <View style={{ marginTop: 10, marginHorizontal: 0, backgroundColor: '#fff' }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <MapPin size={15} color="#10b981" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Delivery Address</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/address' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Text style={{ fontSize: 12, color: COLORS.primary[800], fontWeight: '600' }}>
                {addresses.length > 0 ? `Manage (${addresses.length})` : 'Add'}
              </Text>
              <ChevronRight size={13} color={COLORS.primary[800]} />
            </TouchableOpacity>
          </View>

          {addrLoading ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.primary[800]} />
            </View>
          ) : defaultAddr ? (
            <View style={{
              marginHorizontal: 16, marginBottom: 14,
              backgroundColor: '#f0fdf4', borderRadius: 14,
              padding: 14, borderWidth: 1, borderColor: '#bbf7d0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 10,
                  backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={15} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                      {defaultAddr.recipient_name}
                    </Text>
                    <View style={{
                      backgroundColor: '#dcfce7', paddingHorizontal: 6,
                      paddingVertical: 2, borderRadius: 6,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#16a34a' }}>DEFAULT</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    {defaultAddr.contact_number}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#374151', marginTop: 3, lineHeight: 17 }}>
                    {defaultAddr.street_address}
                    {defaultAddr.barangay_name ? `, ${defaultAddr.barangay_name}` : ''}, Bago City
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/address/edit', params: { address: JSON.stringify(defaultAddr) } } as any)}
                  style={{
                    width: 32, height: 32, borderRadius: 10,
                    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Edit3 size={13} color="#16a34a" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/address/add' as any)}
              style={{
                marginHorizontal: 16, marginBottom: 14,
                borderWidth: 1.5, borderColor: '#e5e7eb', borderStyle: 'dashed',
                borderRadius: 14, padding: 18, alignItems: 'center',
              }}
            >
              <Plus size={20} color={COLORS.primary[800]} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.primary[800], marginTop: 6 }}>
                Add Delivery Address
              </Text>
              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, textAlign: 'center' }}>
                Add your address to start ordering
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Account section ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 10 }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: 0.8,
            paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
          }}>Account</Text>

          <MenuRow
            icon={<Settings size={17} color={COLORS.primary[800]} />}
            iconBg={COLORS.primary[50]}
            label="Edit Profile"
            subtitle="Update name, photo & password"
            onPress={() => router.push('/settings' as any)}
          />
          <Divider />
          <MenuRow
            icon={<MapPin size={17} color="#10b981" />}
            iconBg="#f0fdf4"
            label="Manage Addresses"
            subtitle={`${addresses.length} address${addresses.length !== 1 ? 'es' : ''} saved`}
            onPress={() => router.push('/address' as any)}
          />
          <Divider />
          <MenuRow
            icon={<Package size={17} color="#f59e0b" />}
            iconBg="#fffbeb"
            label="My Orders"
            subtitle="Track and manage your orders"
            onPress={() => router.push('/purchases?tab=all' as any)}
          />
          <Divider />
          <MenuRow
            icon={<Bell size={17} color="#8b5cf6" />}
            iconBg="#f5f3ff"
            label="Notifications"
            subtitle="Alerts and updates"
            onPress={() => router.push('/(tabs)/notifications' as any)}
          />
        </View>

        {/* ── Logout ── */}
        <View style={{ backgroundColor: '#fff', marginTop: 10 }}>
          <MenuRow
            icon={<LogOut size={17} color="#ef4444" />}
            iconBg="#fee2e2"
            label="Logout"
            subtitle="Sign out of your account"
            onPress={handleLogout}
            danger
          />
        </View>

        {/* App version */}
        <Text style={{ textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 20 }}>
          Bago Shop Express v1.0
        </Text>
      </ScrollView>
    </View>
  );
}
