import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../../constants/api';
import { COLORS, SHADOWS } from '../../constants';

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [user, setUser]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [section, setSection]   = useState<'info' | 'password'>('info');

  const [name, setName]                 = useState('');
  const [contact, setContact]           = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]             = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const stored = await AsyncStorage.getItem('rider_user');
    if (stored) {
      const p = JSON.parse(stored);
      setUser(p);
      setName(p.full_name || p.name || '');
      setContact(p.contact_number || '');
    }
  };

  const buildImgUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${IMG}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Needed', 'Gallery access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) uploadPhoto(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) uploadPhoto(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string) => {
    setPhotoLoading(true);
    try {
      const token    = await AsyncStorage.getItem('rider_token');
      const response = await fetch(uri);
      const blob     = await response.blob();
      const base64   = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const res  = await fetch(`${API}/users/profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_photo', image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      const updatedUser = { ...user, profile_image: data.image_url || data.profile_image };
      setUser(updatedUser);
      await AsyncStorage.setItem('rider_user', JSON.stringify(updatedUser));
      Alert.alert('Success', 'Profile photo updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setPhotoLoading(false); }
  };

  const saveProfile = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res   = await fetch(`${API}/users/profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_profile', full_name: name.trim(), contact_number: contact.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      const updated = { ...user, full_name: name.trim(), name: name.trim(), contact_number: contact.trim() };
      setUser(updated);
      await AsyncStorage.setItem('rider_user', JSON.stringify(updated));
      Alert.alert('Success', 'Profile updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  const changePassword = async () => {
    if (!currentPassword) { Alert.alert('Required', 'Enter your current password.'); return; }
    if (!newPassword || newPassword.length < 6) { Alert.alert('Required', 'New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Mismatch', 'New passwords do not match.'); return; }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const res   = await fetch(`${API}/users/profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'change_password', current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Change failed');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('rider_token');
          await AsyncStorage.removeItem('rider_user');
          router.replace('/login');
        },
      },
    ]);
  };

  const profileImage = buildImgUrl(user?.profile_image);

  const inputStyle = {
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 14,
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* ── Header / Hero ──────────────────────────────────────── */}
      <View style={{
        backgroundColor: COLORS.primary,
        paddingTop: insets.top + 14,
        paddingBottom: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 16 }}>
          My Account
        </Text>

        {/* Avatar */}
        <TouchableOpacity
          onPress={() => Alert.alert('Change Photo', 'Choose an option', [
            { text: 'Camera', onPress: takePhoto },
            { text: 'Gallery', onPress: pickPhoto },
            { text: 'Cancel', style: 'cancel' },
          ])}
          activeOpacity={0.85}
          style={{ marginBottom: 14 }}
        >
          <View style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
          }}>
            {photoLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: 96, height: 96 }} />
            ) : (
              <Text style={{ fontSize: 44 }}>👤</Text>
            )}
          </View>
          <View style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 30, height: 30, borderRadius: 15,
            backgroundColor: COLORS.accent,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2.5, borderColor: COLORS.primary,
          }}>
            <Text style={{ fontSize: 13 }}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>
          {user?.full_name || user?.name || 'Rider'}
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          {user?.email}
        </Text>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: 'rgba(255,255,255,0.12)',
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 10,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {user?.role || 'Rider'}
          </Text>
        </View>
      </View>

      {/* Floating section toggle */}
      <View style={{
        marginTop: -22, marginHorizontal: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 5,
        flexDirection: 'row',
        ...SHADOWS.md,
      }}>
        {(['info', 'password'] as const).map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setSection(s)}
            activeOpacity={0.8}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 16,
              backgroundColor: section === s ? COLORS.primary : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: section === s ? '#fff' : COLORS.textSecondary }}>
              {s === 'info' ? '👤  Profile' : '🔒  Password'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {section === 'info' ? (
          /* ── Profile info ── */
          <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 20, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 18 }}>
              Personal Information
            </Text>

            <Text style={labelStyle}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={COLORS.textLight}
              style={inputStyle}
            />

            <Text style={labelStyle}>Email Address</Text>
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 6, borderWidth: 1.5, borderColor: COLORS.border }}>
              <Text style={{ fontSize: 14, color: COLORS.textMuted }}>{user?.email || ''}</Text>
            </View>
            <Text style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 14 }}>
              Email cannot be changed. Contact support if needed.
            </Text>

            <Text style={labelStyle}>Contact Number</Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="09XXXXXXXXX"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              style={inputStyle}
            />

            <TouchableOpacity
              onPress={saveProfile}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
                opacity: loading ? 0.6 : 1,
                marginTop: 4,
                ...SHADOWS.sm,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Change password ── */
          <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 20, ...SHADOWS.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 18 }}>
              Change Password
            </Text>

            <Text style={labelStyle}>Current Password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPw}
              style={inputStyle}
            />

            <Text style={labelStyle}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimum 6 characters"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPw}
              style={inputStyle}
            />

            <Text style={labelStyle}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPw}
              style={{ ...inputStyle, marginBottom: 8 }}
            />

            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600' }}>
                {showPw ? 'Hide passwords' : 'Show passwords'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={changePassword}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.accent,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
                opacity: loading ? 0.6 : 1,
                ...SHADOWS.sm,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {loading ? 'Changing...' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          </View>
        )}


        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.85}
          style={{
            backgroundColor: COLORS.dangerLight,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#fecaca',
          }}
        >
          <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 14 }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const labelStyle: any = {
  fontSize: 11,
  fontWeight: '700',
  color: COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
};
