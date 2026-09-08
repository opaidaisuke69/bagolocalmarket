import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, MapPin, Trash2, Edit2, Star } from 'lucide-react-native';
import { addressesAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { COLORS } from '../../constants';

export default function AddressListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [deleting,  setDeleting]  = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await addressesAPI.list();
      setAddresses(data.addresses || []);
    } catch {
      showToast('Failed to load addresses', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (addr: any) => {
    Alert.alert(
      'Delete Address',
      `Remove "${addr.recipient_name}" at ${addr.street_address}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(addr.id);
            try {
              await addressesAPI.delete(addr.id);
              showToast('Address deleted', 'success');
              load();
            } catch {
              showToast('Failed to delete', 'error');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const hasPIN = !!(item.latitude && item.longitude);
    return (
      <View style={{
        backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
        borderWidth: 1.5,
        borderColor: Number(item.is_default) === 1 ? COLORS.primary[800] : '#e5e7eb',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.gray[900] }}>{item.recipient_name}</Text>
              {Number(item.is_default) === 1 && (
                <View style={{ backgroundColor: COLORS.primary[100], borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.primary[800] }}>DEFAULT</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: COLORS.gray[500], marginBottom: 2 }}>{item.contact_number}</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray[600] }}>
              {item.street_address}{item.barangay_name ? `, ${item.barangay_name}` : ''}, Bago City
            </Text>
            {item.landmark ? <Text style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>Near {item.landmark}</Text> : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <MapPin size={10} color={hasPIN ? '#16a34a' : COLORS.gray[400]} />
              <Text style={{ fontSize: 10, color: hasPIN ? '#16a34a' : COLORS.gray[400], fontWeight: '600' }}>
                {hasPIN ? `GPS pinned · ${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}` : 'No GPS pin — delivery fee may be estimated'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginLeft: 10 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/address/edit', params: { address: JSON.stringify(item) } } as any)}
              style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}
            >
              <Edit2 size={14} color={COLORS.gray[600]} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              disabled={deleting === item.id}
              style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' }}
            >
              {deleting === item.id
                ? <ActivityIndicator size="small" color="#ef4444" />
                : <Trash2 size={14} color="#ef4444" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{
        backgroundColor: COLORS.primary[800],
        paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>My Addresses</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/address/add' as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Plus size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Add New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary[800]} />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <MapPin size={40} color={COLORS.gray[300]} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.gray[500], marginTop: 12 }}>No addresses yet</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray[400], marginTop: 4, textAlign: 'center' }}>Add your delivery address to get started</Text>
              <TouchableOpacity
                onPress={() => router.push('/address/add' as any)}
                style={{ marginTop: 20, backgroundColor: COLORS.primary[800], paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Add Address</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}
