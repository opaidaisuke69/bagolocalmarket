// Redirect shim — dashboard has moved into the (tabs) group
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/(tabs)' as any); }, []);
  return null;
}
