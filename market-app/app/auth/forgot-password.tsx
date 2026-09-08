import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';
import { API_BASE_URL } from '../../constants/api';

export default function ForgotPasswordScreen() {
  const router   = useRouter();
  const { showToast } = useToast();
  const insets   = useSafeAreaInsets();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) { showToast('Please enter your email address.', 'warning'); return; }
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/auth/forgot-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
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

          {!sent ? (
            <>
              <View className="mt-8 mb-10">
                <Text className="text-2xl font-bold text-gray-900">Forgot Password?</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Enter your email and we'll send you a reset link.
                </Text>
              </View>

              {/* Email */}
              <View className="mb-6">
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">Email</Text>
                <View className="relative">
                  <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                    <Mail size={16} color={COLORS.gray[400]} />
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={COLORS.gray[400]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900"
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                className={`bg-primary-800 py-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text className="text-white font-bold text-sm">Send Reset Link</Text>
                }
              </TouchableOpacity>

              <View className="flex-row items-center justify-center mt-6">
                <Text className="text-sm text-gray-500">Remembered your password? </Text>
                <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                  <Text className="text-sm font-bold text-primary-800">Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View className="mt-16 items-center">
              <Text className="text-5xl mb-6">📬</Text>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
                Check Your Email
              </Text>
              <Text className="text-sm text-gray-500 text-center leading-6 mb-2">
                If <Text className="font-semibold text-gray-700">{email}</Text> is registered,
                you'll receive a password reset link shortly.
              </Text>
              <Text className="text-xs text-gray-400 text-center mb-10">
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/auth/login')}
                className="bg-primary-800 py-4 px-10 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-sm">Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
