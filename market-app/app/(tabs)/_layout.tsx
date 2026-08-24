import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Heart, Bell, User } from 'lucide-react-native';
import { COLORS } from '../../constants';
import { useCart } from '../../context/CartContext';

function TabBarIcon({ icon: Icon, focused, badge }: { icon: any; focused: boolean; badge?: number }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <Icon
        size={22}
        color={focused ? COLORS.primary[800] : COLORS.gray[400]}
        fill={focused ? COLORS.primary[800] : 'none'}
      />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -10,
            backgroundColor: '#ef4444',
            borderRadius: 10,
            minWidth: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
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
  const insets = useSafeAreaInsets();

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
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Search} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Heart} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={Bell} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => <TabBarIcon icon={User} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
