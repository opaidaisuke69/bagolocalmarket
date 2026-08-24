import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL as API, IMAGE_BASE_URL as IMG } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const stored = await AsyncStorage.getItem('rider_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      setName(parsed.full_name || parsed.name || '');
      setContact(parsed.contact_number || '');
    }
  };

  const buildImgUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${IMG}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery access is required to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setPhotoLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');

      // Convert to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const res = await fetch(`${API}/users/profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_photo', image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');

      // Update stored user
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
      const res = await fetch(`${API}/users/profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_profile', full_name: name.trim(), contact_number: contact.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');

      const updatedUser = { ...user, full_name: name.trim(), name: name.trim(), contact_number: contact.trim() };
      setUser(updatedUser);
      await AsyncStorage.setItem('rider_user', JSON.stringify(updatedUser));
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
      const res = await fetch(`${API}/users/profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'change_password', current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Change failed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('rider_token');
    await AsyncStorage.removeItem('rider_user');
    router.replace('/login');
  };

  const profileImage = buildImgUrl(user?.profile_image);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '300' }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>My Profile</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 24, alignItems: 'center', ...SHADOWS.sm }}>
          <TouchableOpacity onPress={() => Alert.alert('Change Photo', 'Choose an option', [
            { text: 'Camera', onPress: takePhoto },
            { text: 'Gallery', onPress: pickPhoto },
            { text: 'Cancel', style: 'cancel' },
          ])} activeOpacity={0.8}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: COLORS.primary }}>
              {photoLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : profileImage ? (
                <Image source={{ uri: profileImage }} style={{ width: 100, height: 100 }} />
              ) : (
                <Text style={{ fontSize: 40 }}>👤</Text>
              )}
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' }}>
              <Text style={{ fontSize: 14 }}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 14 }}>{user?.full_name || user?.name || 'Rider'}</Text>
          <Text style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>{user?.email}</Text>
          <View style={{ backgroundColor: COLORS.blueLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.blue, textTransform: 'uppercase' }}>{user?.role || 'Rider'}</Text>
          </View>
        </View>

        {/* Edit Profile */}
        <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 20, ...SHADOWS.sm }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>Edit Profile</Text>

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>Full Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={COLORS.textLight}
            style={{ backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.text, marginBottom: 14 }}
          />

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>Email</Text>
          <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14, borderWidth: 1.5, borderColor: COLORS.border }}>
            <Text style={{ fontSize: 14, color: COLORS.textMuted }}>{user?.email || ''}</Text>
          </View>
          <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: -10, marginBottom: 14 }}>Email cannot be changed. If you need to update it, contact the local market support.</Text>

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>Contact Number</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="09XXXXXXXXX"
            placeholderTextColor={COLORS.textLight}
            keyboardType="phone-pad"
            style={{ backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.text, marginBottom: 16 }}
          />

          <TouchableOpacity onPress={saveProfile} disabled={loading} activeOpacity={0.85}
            style={{ backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{loading ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>

        {/* Change Password */}
        <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 20, ...SHADOWS.sm }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>Change Password</Text>

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>Current Password</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            style={{ backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.text, marginBottom: 14 }}
          />

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimum 6 characters"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            style={{ backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.text, marginBottom: 14 }}
          />

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 }}>Confirm New Password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            style={{ backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.text, marginBottom: 16 }}
          />

          <TouchableOpacity onPress={changePassword} disabled={loading} activeOpacity={0.85}
            style={{ backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 14, alignItems: 'center', opacity: loading ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{loading ? 'Changing...' : 'Change Password'}</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.85}
          style={{ backgroundColor: COLORS.dangerLight, paddingVertical: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' }}>
          <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: 14 }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
