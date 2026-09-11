import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL as API } from '../../constants/api';
import { COLORS, SHADOWS } from '../../constants';

export default function PickupScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take proof photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Gallery access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const uploadProofImage = async (token: string): Promise<string> => {
    const response = await fetch(photo!);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const uploadRes = await fetch(`${API}/rider/upload-proof.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: base64, type: 'pickup' }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.message || 'Upload failed');
    return uploadData.image_url;
  };

  const confirmPickup = async () => {
    if (!photo) { Alert.alert('Required', 'Please take a photo as proof of pickup.'); return; }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('rider_token');
      const proofUrl = await uploadProofImage(token!);
      const res = await fetch(`${API}/rider/orders.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: Number(id), action: 'pickup', proof_image: proofUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Alert.alert('✓ Picked Up', 'Order status changed to Shipped', [{ text: 'OK', onPress: () => router.replace('/(tabs)' as any) }]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: insets.top + 8, paddingBottom: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '300' }}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Pickup Proof</Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Order #{id}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 14 }} showsVerticalScrollIndicator={false}>
        {/* Info */}
        <View style={{ backgroundColor: COLORS.blueLight, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#bfdbfe' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Text style={{ fontSize: 20 }}>📦</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af' }}>Confirm Pickup</Text>
          </View>
          <Text style={{ fontSize: 13, color: '#3b82f6', lineHeight: 20, paddingLeft: 30 }}>
            Take a clear photo showing you received the package from the seller.
          </Text>
        </View>

        {/* Photo Area */}
        <View style={{ backgroundColor: COLORS.card, borderRadius: 18, padding: 18, minHeight: 300, ...SHADOWS.sm }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 16 }}>Proof Photo</Text>
          {photo ? (
            <View>
              <Image source={{ uri: photo }} style={{ width: '100%', height: 260, borderRadius: 16 }} resizeMode="cover" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity onPress={takePhoto} style={{ flex: 1, paddingVertical: 13, borderWidth: 1.5, borderColor: COLORS.borderDark, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' }}>📷 Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFromGallery} style={{ flex: 1, paddingVertical: 13, borderWidth: 1.5, borderColor: COLORS.borderDark, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' }}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={takePhoto}
                activeOpacity={0.8}
                style={{ flex: 1, minHeight: 200, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.borderDark, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafbfc' }}
              >
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Text style={{ fontSize: 32 }}>📷</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>Take Photo</Text>
                <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>Use camera to capture proof</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickFromGallery} style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.bg }}>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' }}>🖼️ Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 16, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={confirmPickup}
          disabled={loading || !photo}
          activeOpacity={0.85}
          style={{
            backgroundColor: photo ? COLORS.primary : COLORS.textLight,
            paddingVertical: 18,
            borderRadius: 16,
            alignItems: 'center',
            ...( photo ? SHADOWS.md : {}),
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Confirm Pickup</Text>}
        </TouchableOpacity>
        {!photo && <Text style={{ fontSize: 11, color: COLORS.danger, textAlign: 'center', marginTop: 8 }}>Photo is required to confirm</Text>}
      </View>
    </View>
  );
}
