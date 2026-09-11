import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Text } from 'react-native';
import { COLORS } from '../constants';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const token = await AsyncStorage.getItem('rider_token');
      // Small delay for splash feel
      await new Promise(r => setTimeout(r, 600));
      if (token) router.replace('/(tabs)' as any);
      else router.replace('/login');
    };
    check();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 40 }}>🛵</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>Bago Riders</Text>
      <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginTop: 32 }} />
    </View>
  );
}
