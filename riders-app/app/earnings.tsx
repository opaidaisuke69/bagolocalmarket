// Redirect shim — earnings has moved into the (tabs) group
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function EarningsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/(tabs)/earnings' as any); }, []);
  return null;
}
