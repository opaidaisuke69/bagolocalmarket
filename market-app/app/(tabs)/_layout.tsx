import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Sparkles, Bell, User } from 'lucide-react-native';
import { COLORS } from '../../constants';
import { useCart } from '../../context/CartContext';

function TabBarIcon({ icon: Icon, focused, badge, accent }: {
  icon: any; focused: boolean; badge?: number; accent?: boolean;
}) {
  const color = focused
    ? (accent ? COLORS.accent[500] : COLORS.primary[800])
    : COLORS.gray[400];
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <Icon size={22} color={color} fill={focused ? color : 'none'} />
      {badge ? (
        <View style={{
          position: 'absolute', top: -4, right: -10,
          backgroundColor: '#ef4444', borderRadius: 10,
          minWidth: 16, height: 16, alignItems: 'center',
          justifyContent: 'center', paddingHorizontal: 4,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { count } = useCart();
  const insets    = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: COLORS.primary[800],
        tabBarInactiveTintColor: COLORS.gray[400],
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      {/* Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Home} focused={focused} />,
        }}
      />

      {/* Shop / Marketplace */}
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Search} focused={focused} />,
        }}
      />

      {/* AI Recommendations — centre spotlight tab */}
      <Tabs.Screen
        name="recommendations"
        options={{
          title: 'For You',
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: focused ? COLORS.accent[400] : COLORS.primary[800],
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
              shadowColor: COLORS.primary[800],
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 6,
            }}>
              <Sparkles size={22} color={focused ? COLORS.primary[900] : '#fff'} />
            </View>
          ),
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', color: COLORS.primary[800] },
        }}
      />

      {/* Notifications */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Bell} focused={focused} />,
        }}
      />

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={User} focused={focused} />,
        }}
      />

      {/* Hidden orders tab — still accessible via deep link */}
      <Tabs.Screen
        name="orders"
        options={{
          href: null,  // hide from tab bar; access via /orders route instead
        }}
      />
    </Tabs>
  );
}
