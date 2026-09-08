import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';
import { API_BASE_URL } from '../../constants/api';

export default function ResetPasswordScreen() {
  const router   = useRouter();
  const { showToast } = useToast();
  const insets   = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenMsg,   setTokenMsg]   = useState('');

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenState('invalid'); setTokenMsg('No reset token provided.'); return; }
    fetch(`${API_BASE_URL}/auth/reset-password.php?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) setTokenState('valid');
        else { setTokenState('invalid'); setTokenMsg(d.message || 'Invalid or expired link.'); }
      })
      .catch(() => { setTokenState('invalid'); setTokenMsg('Could not validate reset link.'); });
  }, [token]);

  const handleSubmit = async () => {
    if (password.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    if (password !== confirm)  { showToast('Passwords do not match.', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirm_password: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
      setDone(true);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => router.back()}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
            <ArrowLeft size={20} color={COLORS.gray[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

          {/* Checking */}
          {tokenState === 'checking' && (
            <View className="mt-20 items-center">
              <ActivityIndicator size="large" color={COLORS.primary[800]} />
              <Text className="text-sm text-gray-500 mt-4">Validating reset link…</Text>
            </View>
          )}

          {/* Invalid */}
          {tokenState === 'invalid' && (
            <View className="mt-16 items-center">
              <Text className="text-5xl mb-6">❌</Text>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-3">Link Invalid or Expired</Text>
              <Text className="text-sm text-gray-500 text-center leading-6 mb-10">{tokenMsg}</Text>
              <TouchableOpacity
                onPress={() => router.replace('/auth/forgot-password')}
                className="bg-primary-800 py-4 px-10 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-sm">Request New Link</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Success */}
          {done && (
            <View className="mt-16 items-center">
              <Text className="text-5xl mb-6">✅</Text>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-3">Password Reset!</Text>
              <Text className="text-sm text-gray-500 text-center leading-6 mb-10">
                Your password has been updated. You can now log in with your new password.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/auth/login')}
                className="bg-primary-800 py-4 px-10 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-sm">Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form */}
          {tokenState === 'valid' && !done && (
            <>
              <View className="mt-8 mb-10">
                <Text className="text-2xl font-bold text-gray-900">Set New Password</Text>
                <Text className="text-sm text-gray-500 mt-1">Choose a strong new password for your account.</Text>
              </View>

              {/* New Password */}
              <View className="mb-4">
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">New Password</Text>
                <View className="relative">
                  <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                    <Lock size={16} color={COLORS.gray[400]} />
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry={!showPw}
                    className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-12 py-3.5 text-sm text-gray-900"
                  />
                  <TouchableOpacity onPress={() => setShowPw(v => !v)}
                    className="absolute right-4 top-0 bottom-0 justify-center">
                    {showPw
                      ? <EyeOff size={16} color={COLORS.gray[400]} />
                      : <Eye   size={16} color={COLORS.gray[400]} />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View className="mb-8">
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">Confirm Password</Text>
                <View className="relative">
                  <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                    <Lock size={16} color={COLORS.gray[400]} />
                  </View>
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Re-enter password"
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry={!showPw}
                    className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900"
                  />
                </View>
                {confirm.length > 0 && (
                  <Text className={`text-xs mt-1.5 ${password === confirm ? 'text-green-600' : 'text-red-500'}`}>
                    {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                className={`bg-primary-800 py-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text className="text-white font-bold text-sm">Reset Password</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
