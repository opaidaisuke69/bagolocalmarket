import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL as API } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

export default function ForgotPasswordScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      await fetch(`${API}/auth/forgot-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show success to prevent enumeration
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={{ alignItems: 'center', paddingTop: insets.top + 50, paddingBottom: 36 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}>
              <Text style={{ fontSize: 40 }}>🔑</Text>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>Forgot Password</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
              Enter your email and we'll send a reset link
            </Text>
          </View>

          {/* Card */}
          <View style={{
            flex: 1, backgroundColor: '#fff',
            borderTopLeftRadius: 36, borderTopRightRadius: 36,
            paddingHorizontal: 28, paddingTop: 36,
            paddingBottom: insets.bottom + 32,
          }}>

            {!sent ? (
              <>
                <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 24 }}>
                  Reset your password
                </Text>

                {error ? (
                  <View style={{
                    backgroundColor: COLORS.dangerLight, borderRadius: 14,
                    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}>
                    <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '500' }}>{error}</Text>
                  </View>
                ) : null}

                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                    Email Address
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="your@email.com"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    style={{
                      backgroundColor: '#f9fafb',
                      borderWidth: 2,
                      borderColor: focused ? COLORS.primary : COLORS.border,
                      borderRadius: 14,
                      paddingHorizontal: 18,
                      paddingVertical: 16,
                      fontSize: 15,
                      color: COLORS.text,
                    }}
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSubmit}
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
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Send Reset Link</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>← Back to login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 20 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>📬</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' }}>
                  Check Your Email
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
                  If <Text style={{ fontWeight: '700', color: COLORS.text }}>{email}</Text> is registered,
                  you'll receive a password reset link shortly.
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginBottom: 36 }}>
                  The link expires in 1 hour. Check your spam folder if you don't see it.
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: COLORS.primary,
                    paddingVertical: 16,
                    paddingHorizontal: 40,
                    borderRadius: 16,
                    ...SHADOWS.md,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
