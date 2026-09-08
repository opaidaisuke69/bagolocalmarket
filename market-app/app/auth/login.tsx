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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
            <ArrowLeft size={20} color={COLORS.gray[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View className="mt-8 mb-10">
            <Text className="text-2xl font-bold text-gray-900">Welcome back</Text>
            <Text className="text-sm text-gray-500 mt-1">Sign in to your Bago Marketplace account</Text>
          </View>

          {/* Email */}
          <View className="mb-4">
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
                className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900"
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xs font-semibold text-gray-500 uppercase">Password</Text>
              <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                <Text className="text-xs font-semibold text-primary-800">Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                <Lock size={16} color={COLORS.gray[400]} />
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray[400]}
                secureTextEntry={!showPassword}
                className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-12 py-3.5 text-sm text-gray-900"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-0 bottom-0 justify-center"
              >
                {showPassword ? (
                  <EyeOff size={16} color={COLORS.gray[400]} />
                ) : (
                  <Eye size={16} color={COLORS.gray[400]} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className={`bg-primary-800 py-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-sm">Login</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View className="flex-row items-center justify-center mt-6">
            <Text className="text-sm text-gray-500">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/register')}>
              <Text className="text-sm font-bold text-primary-800">Register</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
