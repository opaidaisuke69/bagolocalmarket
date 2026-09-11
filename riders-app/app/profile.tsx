// Redirect shim — profile has moved into the (tabs) group
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/(tabs)/profile' as any); }, []);
  return null;
}
