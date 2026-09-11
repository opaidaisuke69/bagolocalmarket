import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';

// ── Tab bar icon component ──────────────────────────────────────────────────
function TabIcon({
  icon, label, focused, badge,
}: {
  icon: string;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4, minWidth: 60 }}>
      <View style={{
        width: 44, height: 30,
        borderRadius: 15,
        backgroundColor: focused ? COLORS.primary + '18' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
        position: 'relative',
      }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
        {badge != null && badge > 0 && (
          <View style={{
            position: 'absolute',
            top: 0,
            right: 2,
            backgroundColor: COLORS.accent,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
            borderWidth: 1.5,
            borderColor: '#fff',
          }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: '#fff' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={{
        fontSize: 10,
        fontWeight: focused ? '700' : '500',
        color: focused ? COLORS.primary : COLORS.textMuted,
        letterSpacing: 0.1,
      }}>
        {label}
      </Text>
    </View>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f2f5',
          height: 62 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
          paddingHorizontal: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📦" label="Orders" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📊" label="Earnings" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="remittance"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💸" label="Remittance" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
