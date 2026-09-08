import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ArrowLeft, Navigation, CheckCircle, MapPin } from 'lucide-react-native';
import { addressesAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';
import LeafletMapPicker, { LeafletMapPickerRef } from '../../components/map/LeafletMapPicker';

async function fetchBarangays() {
  const { request } = await import('../../services/api') as any;
  return request('/barangays/list.php');
}

export default function EditAddressScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { showToast } = useToast();
  const params  = useLocalSearchParams<{ address: string }>();
  const mapRef  = useRef<LeafletMapPickerRef>(null);

  const [barangays, setBarangays] = useState<any[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [locating,  setLocating]  = useState(false);
  const [pinned,    setPinned]    = useState(false);

  const [form, setForm] = useState({
    id:             0,
    recipient_name: '',
    contact_number: '',
    barangay_id:    '',
    street_address: '',
    landmark:       '',
    delivery_notes: '',
    is_default:     false,
    latitude:       null as number | null,
    longitude:      null as number | null,
  });

  useEffect(() => {
    fetchBarangays()
      .then((d: any) => setBarangays(d.barangays || []))
      .catch(() => {});

    // Parse the address passed as JSON param
    if (params.address) {
      try {
        const addr = JSON.parse(params.address as string);
        setForm({
          id:             addr.id,
          recipient_name: addr.recipient_name || '',
          contact_number: addr.contact_number || '',
          barangay_id:    String(addr.barangay_id || ''),
          street_address: addr.street_address || '',
          landmark:       addr.landmark || '',
          delivery_notes: addr.delivery_notes || '',
          is_default:     !!Number(addr.is_default),
          latitude:       addr.latitude  ? Number(addr.latitude)  : null,
          longitude:      addr.longitude ? Number(addr.longitude) : null,
        });
        if (addr.latitude && addr.longitude) setPinned(true);
      } catch {}
    }
  }, []);

  const set = (field: string, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const getGPSLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed.');
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setForm(f => ({ ...f, latitude, longitude }));
      setPinned(true);
      if (mapRef.current) mapRef.current.jumpTo(latitude, longitude);
    } catch {
      Alert.alert('GPS Error', 'Could not get location. Please pin manually.');
    } finally {
      setLocating(false);
    }
  }, []);

  const handleMapPin = useCallback((lat: number, lng: number) => {
    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
    setPinned(true);
  }, []);

  const handleSave = async () => {
    if (!form.recipient_name.trim()) { showToast('Recipient name is required', 'warning'); return; }
    if (!form.contact_number.trim()) { showToast('Contact number is required', 'warning'); return; }
    if (!form.street_address.trim()) { showToast('Street address is required', 'warning'); return; }
    if (!form.latitude || !form.longitude) {
      Alert.alert('Pin Required', 'Please pin your exact location on the map.');
      return;
    }

    setSaving(true);
    try {
      await addressesAPI.update({
        id:             form.id,
        recipient_name: form.recipient_name.trim(),
        contact_number: form.contact_number.trim(),
        barangay_id:    form.barangay_id || undefined,
        street_address: form.street_address.trim(),
        landmark:       form.landmark.trim(),
        delivery_notes: form.delivery_notes.trim(),
        is_default:     form.is_default,
        latitude:       form.latitude,
        longitude:      form.longitude,
      });
      showToast('Address updated!', 'success');
      router.back();
    } catch (err: any) {
      showToast(err.message || 'Failed to update address', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 13, color: COLORS.gray[900], marginBottom: 12,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Edit Address</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>

        {/* Contact */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray[500], marginBottom: 12, textTransform: 'uppercase' }}>Contact Info</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 }}>Recipient Name *</Text>
          <TextInput value={form.recipient_name} onChangeText={v => set('recipient_name', v)} placeholder="Juan Dela Cruz" placeholderTextColor={COLORS.gray[400]} style={inputStyle} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 }}>Contact Number *</Text>
          <TextInput value={form.contact_number} onChangeText={v => set('contact_number', v)} placeholder="09XX XXX XXXX" placeholderTextColor={COLORS.gray[400]} keyboardType="phone-pad" style={{ ...inputStyle, marginBottom: 0 }} />
        </View>

        {/* Address */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray[500], marginBottom: 12, textTransform: 'uppercase' }}>Address</Text>

          {barangays.length > 0 && (
            <>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 }}>Barangay</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {barangays.map((b: any) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => set('barangay_id', String(b.id))}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                      backgroundColor: form.barangay_id === String(b.id) ? COLORS.primary[800] : '#f3f4f6',
                      borderWidth: 1, borderColor: form.barangay_id === String(b.id) ? COLORS.primary[800] : '#e5e7eb',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: form.barangay_id === String(b.id) ? '#fff' : COLORS.gray[700] }}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 }}>Street / House No. / Purok *</Text>
          <TextInput value={form.street_address} onChangeText={v => set('street_address', v)} placeholder="e.g. 123 Rizal St." placeholderTextColor={COLORS.gray[400]} style={inputStyle} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 }}>Landmark</Text>
          <TextInput value={form.landmark} onChangeText={v => set('landmark', v)} placeholder="Near school, church…" placeholderTextColor={COLORS.gray[400]} style={inputStyle} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.gray[700], marginBottom: 6 }}>Delivery Notes</Text>
          <TextInput value={form.delivery_notes} onChangeText={v => set('delivery_notes', v)} placeholder="Leave at gate…" placeholderTextColor={COLORS.gray[400]} multiline numberOfLines={2} style={{ ...inputStyle, textAlignVertical: 'top', marginBottom: 0 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray[700] }}>Set as default</Text>
            <Switch value={form.is_default} onValueChange={v => set('is_default', v)} trackColor={{ false: COLORS.gray[300], true: COLORS.primary[800] }} thumbColor="#fff" />
          </View>
        </View>

        {/* Map */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray[500], textTransform: 'uppercase' }}>Exact Location *</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>Required for accurate delivery fee</Text>
            </View>
            {pinned && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={14} color="#16a34a" />
                <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '600' }}>Pinned</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={getGPSLocation}
            disabled={locating}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary[800], borderRadius: 10, paddingVertical: 11, marginBottom: 12, opacity: locating ? 0.7 : 1 }}
          >
            {locating ? <ActivityIndicator size="small" color="#fff" /> : <Navigation size={15} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{locating ? 'Getting GPS…' : 'Use My GPS Location'}</Text>
          </TouchableOpacity>

          <LeafletMapPicker ref={mapRef} latitude={form.latitude} longitude={form.longitude} onLocationSelect={handleMapPin} height={280} />

          {form.latitude && form.longitude && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <MapPin size={11} color={COLORS.gray[400]} />
              <Text style={{ fontSize: 10, color: COLORS.gray[400] }}>{form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</Text>
            </View>
          )}
          <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 6, textAlign: 'center' }}>Tap the map or drag the pin to adjust</Text>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: 16, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ backgroundColor: saving ? COLORS.gray[300] : COLORS.primary[800], borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
