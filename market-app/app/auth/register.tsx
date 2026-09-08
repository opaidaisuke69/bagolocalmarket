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
import { ArrowLeft, Eye, EyeOff, User, Mail, Lock, Phone } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      await register({
        full_name: name.trim(),
        email: email.trim(),
        contact_number: phone.trim(),
        password,
        confirm_password: confirmPassword,
        role: 'buyer',
      });
      showToast('Account created! Please check your email to verify.', 'success');
      router.replace('/auth/login');
    } catch (err: any) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
            <ArrowLeft size={20} color={COLORS.gray[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <View className="mt-6 mb-8">
            <Text className="text-2xl font-bold text-gray-900">Create Account</Text>
            <Text className="text-sm text-gray-500 mt-1">Join Bago Marketplace today</Text>
          </View>

          {/* Name */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">Full Name</Text>
            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                <User size={16} color={COLORS.gray[400]} />
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Juan Dela Cruz"
                placeholderTextColor={COLORS.gray[400]}
                className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900"
              />
            </View>
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

          {/* Phone */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">Contact Number</Text>
            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                <Phone size={16} color={COLORS.gray[400]} />
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="09XX XXX XXXX"
                placeholderTextColor={COLORS.gray[400]}
                keyboardType="phone-pad"
                className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900"
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">Password</Text>
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
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="absolute right-4 top-0 bottom-0 justify-center">
                {showPassword ? <EyeOff size={16} color={COLORS.gray[400]} /> : <Eye size={16} color={COLORS.gray[400]} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">Confirm Password</Text>
            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                <Lock size={16} color={COLORS.gray[400]} />
              </View>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray[400]}
                secureTextEntry={!showPassword}
                className="bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm text-gray-900"
              />
            </View>
          </View>

          {/* Register button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className={`bg-primary-800 py-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-sm">Create Account</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center justify-center mt-6 mb-10">
            <Text className="text-sm text-gray-500">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text className="text-sm font-bold text-primary-800">Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
