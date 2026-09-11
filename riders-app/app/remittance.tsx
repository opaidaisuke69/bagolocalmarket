// Redirect shim — remittance has moved into the (tabs) group
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function RemittanceRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/(tabs)/remittance' as any); }, []);
  return null;
}
