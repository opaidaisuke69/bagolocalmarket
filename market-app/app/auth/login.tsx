import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'warning');
      return;
    }
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      showToast('Welcome back!', 'success');
      router.back();
    } catch (err: any) {
      showToast(err.message || 'Invalid credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  const PRIMARY = COLORS.primary[800];
  const PRIMARY_DARK = COLORS.primary[900];
  const PRIMARY_LIGHT = COLORS.primary[50];

  return (
    <View style={{ flex: 1, backgroundColor: PRIMARY }}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* ── Top branded section ───────────────────────────── */}
          <View style={{
            paddingTop: insets.top + 32,
            paddingBottom: 36,
            alignItems: 'center',
            paddingHorizontal: 24,
          }}>
            {/* Logo */}
            <Image
              source={require('../../assets/images/logo.png')}
              style={{ width: 100, height: 100, marginBottom: 20 }}
              resizeMode="contain"
            />

            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>
              Bago Shop Express
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, letterSpacing: 0.2 }}>
              Your local marketplace in Bago City
            </Text>
          </View>

          {/* ── Form card ─────────────────────────────────────── */}
          <View style={{
            flex: 1,
            backgroundColor: '#fff',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingHorizontal: 28,
            paddingTop: 36,
            paddingBottom: insets.bottom + 32,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 8,
          }}>

            {/* Greeting */}
            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.gray[900], marginBottom: 6 }}>
              Welcome back 👋
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.gray[500], marginBottom: 32, lineHeight: 20 }}>
              Sign in to continue shopping
            </Text>

            {/* Email field */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[500], marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Email Address
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: focusedField === 'email' ? PRIMARY_LIGHT : COLORS.gray[50],
              borderWidth: 1.5,
              borderColor: focusedField === 'email' ? PRIMARY : COLORS.gray[200],
              borderRadius: 14,
              paddingHorizontal: 14,
              marginBottom: 20,
              height: 52,
            }}>
              <Mail size={18} color={focusedField === 'email' ? PRIMARY : COLORS.gray[400]} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.gray[400]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 15,
                  color: COLORS.gray[900],
                  height: '100%',
                }}
              />
            </View>

            {/* Password field */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray[500], textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Password
              </Text>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY }}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: focusedField === 'password' ? PRIMARY_LIGHT : COLORS.gray[50],
              borderWidth: 1.5,
              borderColor: focusedField === 'password' ? PRIMARY : COLORS.gray[200],
              borderRadius: 14,
              paddingHorizontal: 14,
              marginBottom: 32,
              height: 52,
            }}>
              <Lock size={18} color={focusedField === 'password' ? PRIMARY : COLORS.gray[400]} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray[400]}
                secureTextEntry={!showPassword}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 15,
                  color: COLORS.gray[900],
                  height: '100%',
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword
                  ? <EyeOff size={18} color={COLORS.gray[400]} />
                  : <Eye size={18} color={COLORS.gray[400]} />
                }
              </TouchableOpacity>
            </View>

            {/* Login button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: loading ? COLORS.primary[600] : PRIMARY,
                borderRadius: 16,
                height: 56,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                shadowColor: PRIMARY_DARK,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 8,
                marginBottom: 28,
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
                    Sign In
                  </Text>
                  <ArrowRight size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.gray[200] }} />
              <Text style={{ marginHorizontal: 12, fontSize: 12, color: COLORS.gray[400], fontWeight: '500' }}>
                New to Bago Shop Express?
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.gray[200] }} />
            </View>

            {/* Register button */}
            <TouchableOpacity
              onPress={() => router.replace('/auth/register')}
              activeOpacity={0.8}
              style={{
                borderWidth: 2,
                borderColor: PRIMARY,
                borderRadius: 16,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: PRIMARY, fontWeight: '700', fontSize: 15 }}>
                Create an Account
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
