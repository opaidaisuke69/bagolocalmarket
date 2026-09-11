import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, Camera, User, Phone, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, Save,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../services/api';
import { COLORS } from '../constants';
import { IMAGE_BASE_URL } from '../constants/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type Section = 'profile' | 'password';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

// ── Small reusable field ───────────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, editable = true,
  icon,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
      }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: editable ? '#fff' : '#f9fafb',
        borderWidth: 1.5, borderColor: '#e5e7eb',
        borderRadius: 13, paddingHorizontal: 14,
        minHeight: 50,
      }}>
        {icon ? <View style={{ marginRight: 10 }}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#c4c9d4"
          keyboardType={keyboardType}
          editable={editable}
          style={{
            flex: 1, fontSize: 14, color: editable ? '#111827' : '#9ca3af',
            paddingVertical: 12,
          }}
        />
      </View>
    </View>
  );
}

// ── Password field ─────────────────────────────────────────────────────────────
function PasswordField({
  label, value, onChangeText, placeholder,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
      }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb',
        borderRadius: 13, paddingHorizontal: 14, minHeight: 50,
      }}>
        <Lock size={16} color="#9ca3af" style={{ marginRight: 10 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#c4c9d4"
          secureTextEntry={!show}
          style={{ flex: 1, fontSize: 14, color: '#111827', paddingVertical: 12 }}
        />
        <TouchableOpacity onPress={() => setShow(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {show
            ? <EyeOff size={18} color="#9ca3af" />
            : <Eye size={18} color="#9ca3af" />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────────
function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1, paddingVertical: 10, alignItems: 'center',
        borderBottomWidth: 2.5,
        borderBottomColor: active ? COLORS.primary[800] : 'transparent',
      }}
    >
      <Text style={{
        fontSize: 13, fontWeight: '700',
        color: active ? COLORS.primary[800] : '#9ca3af',
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user, refreshUser, updateUser } = useAuth();

  const [section, setSection] = useState<Section>('profile');
  const [toast,   setToast]   = useState<Toast | null>(null);
  const [saving,  setSaving]  = useState(false);

  // ── Profile form ─────────────────────────────────────────────────────────
  const [fullName,       setFullName]       = useState('');
  const [contactNumber,  setContactNumber]  = useState('');
  const [avatarUri,      setAvatarUri]      = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── Password form ─────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // ── Init form from user ───────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || user.name || '');
      setContactNumber(user.contact_number || user.phone || '');
      if (user.profile_image) {
        const img = user.profile_image;
        setAvatarUri(img.startsWith('http') ? img : `${IMAGE_BASE_URL}${img}`);
      }
    }
  }, [user]);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Pick & upload photo ───────────────────────────────────────────────────
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      showToast('Failed to read image.', 'error');
      return;
    }

    const mimeType = asset.mimeType || 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${asset.base64}`;

    setUploadingPhoto(true);
    try {
      const res = await profileAPI.updatePhoto(base64Data);
      const newUrl = res.profile_image || res.image_url;
      const fullUrl = newUrl?.startsWith('http') ? newUrl : `${IMAGE_BASE_URL}${newUrl}`;
      setAvatarUri(fullUrl);
      await updateUser({ profile_image: newUrl });
      showToast('Profile photo updated!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to upload photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) { showToast('Failed to read image.', 'error'); return; }

    const mimeType = asset.mimeType || 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${asset.base64}`;

    setUploadingPhoto(true);
    try {
      const res = await profileAPI.updatePhoto(base64Data);
      const newUrl = res.profile_image || res.image_url;
      const fullUrl = newUrl?.startsWith('http') ? newUrl : `${IMAGE_BASE_URL}${newUrl}`;
      setAvatarUri(fullUrl);
      await updateUser({ profile_image: newUrl });
      showToast('Profile photo updated!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to upload photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoPress = () => {
    Alert.alert('Update Photo', 'Choose a source', [
      { text: 'Camera',        onPress: takePhoto },
      { text: 'Photo Library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!fullName.trim()) { showToast('Name is required.', 'error'); return; }
    setSaving(true);
    try {
      await profileAPI.update({ full_name: fullName.trim(), contact_number: contactNumber.trim() });
      await updateUser({ name: fullName.trim(), full_name: fullName.trim(), contact_number: contactNumber.trim() });
      showToast('Profile updated successfully!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const savePassword = async () => {
    if (!currentPw) { showToast('Enter your current password.', 'error'); return; }
    if (newPw.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match.', 'error'); return; }

    setSaving(true);
    try {
      await profileAPI.changePassword({ current_password: currentPw, new_password: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password changed successfully!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to change password.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || '?')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* ── Top bar ── */}
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 10,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
          }}
        >
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 }}>
          Settings
        </Text>
      </View>

      {/* ── Toast ── */}
      {toast && (
        <View style={{
          position: 'absolute', top: insets.top + 70, left: 16, right: 16, zIndex: 999,
          backgroundColor: toast.type === 'success' ? '#dcfce7' : '#fee2e2',
          borderRadius: 14, padding: 14,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
          borderWidth: 1, borderColor: toast.type === 'success' ? '#86efac' : '#fca5a5',
        }}>
          {toast.type === 'success'
            ? <CheckCircle size={18} color="#16a34a" />
            : <AlertCircle size={18} color="#ef4444" />
          }
          <Text style={{
            flex: 1, fontSize: 13, fontWeight: '600',
            color: toast.type === 'success' ? '#15803d' : '#dc2626',
          }}>
            {toast.message}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* ── Avatar section ── */}
          <View style={{
            backgroundColor: '#fff',
            alignItems: 'center',
            paddingVertical: 28,
          }}>
            <TouchableOpacity
              onPress={handlePhotoPress}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
              style={{ position: 'relative' }}
            >
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: COLORS.primary[100],
                overflow: 'hidden',
                borderWidth: 3, borderColor: COLORS.primary[200],
              }}>
                {uploadingPhoto ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
                    <ActivityIndicator color={COLORS.primary[800]} />
                  </View>
                ) : avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: COLORS.primary[800], fontSize: 34, fontWeight: '800' }}>{initials}</Text>
                  </View>
                )}
              </View>

              {/* Camera badge overlay */}
              <View style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: COLORS.primary[800],
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: '#fff',
              }}>
                <Camera size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            <Text style={{ fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 12 }}>
              {user?.name || user?.full_name}
            </Text>
            <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>{user?.email}</Text>
          </View>

          {/* ── Tabs ── */}
          <View style={{
            backgroundColor: '#fff', marginTop: 10,
            flexDirection: 'row',
            borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
          }}>
            <TabBtn label="Edit Profile"     active={section === 'profile'}  onPress={() => setSection('profile')}  />
            <TabBtn label="Change Password"  active={section === 'password'} onPress={() => setSection('password')} />
          </View>

          {/* ── Profile section ── */}
          {section === 'profile' && (
            <View style={{
              backgroundColor: '#fff', padding: 20,
              marginTop: 0,
            }}>
              <Field
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                icon={<User size={16} color="#9ca3af" />}
              />
              <Field
                label="Email Address"
                value={user?.email || ''}
                onChangeText={() => {}}
                editable={false}
                placeholder="Email address"
              />
              <Field
                label="Contact Number"
                value={contactNumber}
                onChangeText={setContactNumber}
                placeholder="09XX XXX XXXX"
                keyboardType="phone-pad"
                icon={<Phone size={16} color="#9ca3af" />}
              />

              <TouchableOpacity
                onPress={saveProfile}
                disabled={saving}
                style={{
                  backgroundColor: saving ? '#93a3b8' : COLORS.primary[800],
                  paddingVertical: 15, borderRadius: 14,
                  alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 8, marginTop: 4,
                }}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Save size={16} color="#fff" />
                }
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {saving ? 'Saving…' : 'Save Profile'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Password section ── */}
          {section === 'password' && (
            <View style={{
              backgroundColor: '#fff', padding: 20, marginTop: 0,
            }}>
              <View style={{
                backgroundColor: '#eff6ff', borderRadius: 12, padding: 13,
                marginBottom: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 10,
              }}>
                <Lock size={15} color={COLORS.primary[800]} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, color: COLORS.primary[800], lineHeight: 18 }}>
                  Your password must be at least 6 characters long. Choose something strong and unique.
                </Text>
              </View>

              <PasswordField
                label="Current Password"
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder="Enter current password"
              />
              <PasswordField
                label="New Password"
                value={newPw}
                onChangeText={setNewPw}
                placeholder="At least 6 characters"
              />
              <PasswordField
                label="Confirm New Password"
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Repeat new password"
              />

              {/* Password strength hint */}
              {newPw.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[1, 2, 3, 4].map(i => (
                      <View
                        key={i}
                        style={{
                          flex: 1, height: 4, borderRadius: 3,
                          backgroundColor:
                            newPw.length >= i * 3
                              ? (newPw.length >= 10 ? '#16a34a' : newPw.length >= 7 ? '#f59e0b' : '#ef4444')
                              : '#e5e7eb',
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{
                    fontSize: 11, color: '#9ca3af', marginTop: 4,
                  }}>
                    Strength: {newPw.length < 6 ? 'Weak' : newPw.length < 8 ? 'Fair' : newPw.length < 10 ? 'Good' : 'Strong'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={savePassword}
                disabled={saving}
                style={{
                  backgroundColor: saving ? '#93a3b8' : COLORS.primary[800],
                  paddingVertical: 15, borderRadius: 14,
                  alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 8, marginTop: 4,
                }}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Lock size={16} color="#fff" />
                }
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {saving ? 'Saving…' : 'Change Password'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
