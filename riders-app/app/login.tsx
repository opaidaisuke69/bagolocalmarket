import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as API } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/auth/login.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      await AsyncStorage.setItem('rider_token', data.token);
      await AsyncStorage.setItem('rider_user', JSON.stringify(data.user));
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 60, paddingBottom: 40 }}>
            <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: 44 }}>🛵</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>Bago Riders</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 8, fontWeight: '400' }}>Delivery Partner App</Text>
          </View>

          {/* Form Card */}
          <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 28, paddingTop: 36, paddingBottom: insets.bottom + 32 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Welcome back</Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 }}>Sign in to start delivering orders</Text>

            {error ? (
              <View style={{ backgroundColor: COLORS.dangerLight, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '500', flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={{
                  backgroundColor: '#f9fafb',
                  borderWidth: 2,
                  borderColor: focused === 'email' ? COLORS.primary : COLORS.border,
                  borderRadius: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  fontSize: 15,
                  color: COLORS.text,
                }}
              />
            </View>

            {/* Password */}
            <View style={{ marginBottom: 28 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textLight}
                secureTextEntry
                autoComplete="password"
                style={{
                  backgroundColor: '#f9fafb',
                  borderWidth: 2,
                  borderColor: focused === 'password' ? COLORS.primary : COLORS.border,
                  borderRadius: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  fontSize: 15,
                  color: COLORS.text,
                }}
              />
            </View>

            {/* Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: 'center',
                opacity: loading ? 0.7 : 1,
                ...SHADOWS.md,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
