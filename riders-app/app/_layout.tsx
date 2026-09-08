import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index"           options={{ animation: 'none' }} />
        <Stack.Screen name="login"           options={{ animation: 'fade' }} />
        <Stack.Screen name="signup"          options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reset-password"  options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="dashboard"       options={{ animation: 'fade' }} />
        <Stack.Screen name="profile" />
        <Stack.Screen name="earnings"    options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="remittance"  options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="wallet"      options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="pickup/[id]"  options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="deliver/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
