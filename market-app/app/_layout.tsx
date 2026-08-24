import '../global.css';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { CartProvider } from '../context/CartContext';
import { WishlistProvider } from '../context/WishlistContext';
import { COLORS } from '../constants';

export default function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <View style={{ flex: 1, backgroundColor: COLORS.primary[800] }}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="auth/login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="auth/register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="cart" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="orders/index" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="orders/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="search" options={{ animation: 'fade' }} />
                <Stack.Screen name="store/[sellerId]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="purchases" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="rate/[orderId]" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />
              </Stack>
              <StatusBar style="light" backgroundColor={COLORS.primary[800]} />
            </View>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
