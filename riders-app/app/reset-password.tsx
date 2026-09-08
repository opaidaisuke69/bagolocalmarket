import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL as API } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

export default function ResetPasswordScreen() {
  const { token }  = useLocalSearchParams<{ token: string }>();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();

  const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenMsg,   setTokenMsg]   = useState('');

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [focused,   setFocused]   = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenState('invalid'); setTokenMsg('No reset token found.'); return; }
    fetch(`${API}/auth/reset-password.php?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) setTokenState('valid');
        else { setTokenState('invalid'); setTokenMsg(d.message || 'Invalid or expired link.'); }
      })
      .catch(() => { setTokenState('invalid'); setTokenMsg('Could not validate reset link.'); });
  }, [token]);

  const handleSubmit = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirm_password: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
      Alert.alert('Password Reset!', 'Your password has been updated. You can now log in.', [
        { text: 'Log In', onPress: () => router.replace('/login') },
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (key: string) => ({
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: focused === key ? COLORS.primary : COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: COLORS.text,
  });

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
              <Text style={{ fontSize: 40 }}>🔒</Text>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>New Password</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
              Set a new secure password
            </Text>
          </View>

          {/* Card */}
          <View style={{
            flex: 1, backgroundColor: '#fff',
            borderTopLeftRadius: 36, borderTopRightRadius: 36,
            paddingHorizontal: 28, paddingTop: 36,
            paddingBottom: insets.bottom + 32,
          }}>

            {tokenState === 'checking' && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 16, fontSize: 14 }}>
                  Validating reset link…
                </Text>
              </View>
            )}

            {tokenState === 'invalid' && (
              <View style={{ alignItems: 'center', paddingTop: 20 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>❌</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' }}>
                  Link Invalid or Expired
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
                  {tokenMsg}
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace('/forgot-password')}
                  activeOpacity={0.85}
                  style={{ backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, ...SHADOWS.md }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Request New Link</Text>
                </TouchableOpacity>
              </View>
            )}

            {tokenState === 'valid' && (
              <>
                <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 24 }}>
                  Set New Password
                </Text>

                {error ? (
                  <View style={{
                    backgroundColor: COLORS.dangerLight, borderRadius: 14,
                    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20,
                    flexDirection: 'row', alignItems: 'center',
                  }}>
                    <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '500' }}>⚠️ {error}</Text>
                  </View>
                ) : null}

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                    New Password
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={COLORS.textLight}
                    secureTextEntry={!showPw}
                    style={inputStyle('password')}
                  />
                </View>

                <View style={{ marginBottom: 28 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 }}>
                    Confirm New Password
                  </Text>
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                    placeholder="Re-enter password"
                    placeholderTextColor={COLORS.textLight}
                    secureTextEntry={!showPw}
                    style={inputStyle('confirm')}
                  />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600' }}>
                      {showPw ? 'Hide passwords' : 'Show passwords'}
                    </Text>
                  </TouchableOpacity>
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
                    : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Reset Password</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
