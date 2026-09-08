import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL as API } from '../constants/api';
import { COLORS, SHADOWS } from '../constants';

// ── Types ─────────────────────────────────────────────────────
type Field =
  | 'full_name' | 'email' | 'contact_number' | 'birthdate'
  | 'password'  | 'confirm_password';

interface FormState {
  full_name:        string;
  email:            string;
  contact_number:   string;
  birthdate:        string;   // YYYY-MM-DD
  sex:              'male' | 'female' | 'other' | '';
  password:         string;
  confirm_password: string;
}

interface FileAsset {
  uri:  string;
  name: string;
  type: string;
}

// ── Helpers ───────────────────────────────────────────────────
const inputStyle = (focused: string | null, key: string) => ({
  backgroundColor: '#f9fafb',
  borderWidth: 2,
  borderColor: focused === key ? COLORS.primary : COLORS.border,
  borderRadius: 14,
  paddingHorizontal: 18,
  paddingVertical: 16,
  fontSize: 15,
  color: COLORS.text,
});

const labelStyle = {
  fontSize: 13,
  fontWeight: '600' as const,
  color: COLORS.text,
  marginBottom: 8,
};

const sectionTitle = {
  fontSize: 15,
  fontWeight: '700' as const,
  color: COLORS.text,
  marginBottom: 16,
  marginTop: 8,
};

// ── Component ─────────────────────────────────────────────────
export default function SignupScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPw,  setShowPw]  = useState(false);

  const [form, setForm] = useState<FormState>({
    full_name: '', email: '', contact_number: '',
    birthdate: '', sex: '',
    password: '', confirm_password: '',
  });

  const [licenseFile,  setLicenseFile]  = useState<FileAsset | null>(null);
  const [regFile,      setRegFile]      = useState<FileAsset | null>(null);

  const set = (field: Field, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  // ── Image picker ─────────────────────────────────────────────
  const pickImage = async (setter: (a: FileAsset) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext   = asset.uri.split('.').pop() || 'jpg';
      setter({ uri: asset.uri, name: `upload.${ext}`, type: `image/${ext}` });
    }
  };

  // ── Validation ────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!form.full_name.trim())        return 'Full name is required.';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
                                       return 'Valid email is required.';
    if (!form.contact_number.trim())   return 'Contact number is required.';
    if (!form.birthdate)               return 'Birthdate is required.';
    if (!form.sex)                     return 'Please select your sex.';
    if (form.password.length < 8)      return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm_password)
                                       return 'Passwords do not match.';
    if (!licenseFile)                  return "Driver's license image is required.";
    if (!regFile)                      return 'Motorcycle registration image is required.';
    // Age check ≥ 18
    const birth = new Date(form.birthdate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    if (isNaN(birth.getTime()) || age < 18) return 'You must be at least 18 years old.';
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);

    try {
      const fd = new FormData();
      (Object.keys(form) as (keyof FormState)[]).forEach(k => {
        fd.append(k, form[k] as string);
      });

      // Append files — React Native FormData needs { uri, name, type }
      if (licenseFile) {
        fd.append('driver_license', {
          uri:  licenseFile.uri,
          name: licenseFile.name,
          type: licenseFile.type,
        } as any);
      }
      if (regFile) {
        fd.append('motorcycle_registration', {
          uri:  regFile.uri,
          name: regFile.name,
          type: regFile.type,
        } as any);
      }

      const res = await fetch(`${API}/rider/register.php`, {
        method: 'POST',
        body: fd,
        // Do NOT set Content-Type manually — fetch sets it with the correct boundary
      });

      // Safely parse — server may return HTML on fatal error
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.substring(0, 300));
        throw new Error('Server error. Please try again.');
      }

      if (!res.ok) throw new Error(data.message || 'Registration failed.');

      Alert.alert(
        'Registration Submitted!',
        'Please check your email to verify your account. Your application will be reviewed before you can log in.',
        [{ text: 'Go to Login', onPress: () => router.replace('/login') }],
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── File picker button ────────────────────────────────────────
  const FileButton = ({
    label, file, onPress,
  }: { label: string; file: FileAsset | null; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        borderWidth: 2,
        borderColor: file ? COLORS.success : COLORS.border,
        borderStyle: file ? 'solid' : 'dashed',
        borderRadius: 14,
        paddingVertical: 18,
        paddingHorizontal: 18,
        alignItems: 'center',
        backgroundColor: file ? COLORS.successLight : '#f9fafb',
        flexDirection: 'row',
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 22 }}>{file ? '✅' : '📎'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: file ? COLORS.success : COLORS.textSecondary }}>
          {file ? file.name : label}
        </Text>
        {!file && (
          <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
            Tap to select from gallery
          </Text>
        )}
      </View>
      {file && (
        <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Change</Text>
      )}
    </TouchableOpacity>
  );

  // ── Sex selector ──────────────────────────────────────────────
  const SexButton = ({ val, label }: { val: FormState['sex']; label: string }) => (
    <TouchableOpacity
      onPress={() => setForm(f => ({ ...f, sex: val }))}
      activeOpacity={0.8}
      style={{
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: form.sex === val ? COLORS.primary : COLORS.border,
        backgroundColor: form.sex === val ? COLORS.primary + '12' : '#f9fafb',
        alignItems: 'center',
      }}
    >
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: form.sex === val ? COLORS.primary : COLORS.textSecondary,
      }}>{label}</Text>
    </TouchableOpacity>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 40, paddingBottom: 32 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}>
              <Text style={{ fontSize: 40 }}>🛵</Text>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>Bago Riders</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>Delivery Partner Sign Up</Text>
          </View>

          {/* Form card */}
          <View style={{
            flex: 1, backgroundColor: '#fff',
            borderTopLeftRadius: 36, borderTopRightRadius: 36,
            paddingHorizontal: 28, paddingTop: 36,
            paddingBottom: insets.bottom + 40,
          }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 }}>Create Account</Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 }}>Fill in all fields to apply as a rider</Text>

            {/* Error */}
            {error ? (
              <View style={{
                backgroundColor: COLORS.dangerLight, borderRadius: 14,
                paddingHorizontal: 16, paddingVertical: 12,
                marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
              }}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '500', flex: 1 }}>{error}</Text>
              </View>
            ) : null}

            {/* ── Personal Info ── */}
            <Text style={sectionTitle}>Personal Information</Text>

            <View style={{ marginBottom: 16 }}>
              <Text style={labelStyle}>Full Name</Text>
              <TextInput
                value={form.full_name}
                onChangeText={v => set('full_name', v)}
                onFocus={() => setFocused('full_name')}
                onBlur={() => setFocused(null)}
                placeholder="Juan Dela Cruz"
                placeholderTextColor={COLORS.textLight}
                style={inputStyle(focused, 'full_name')}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={labelStyle}>Email Address</Text>
              <TextInput
                value={form.email}
                onChangeText={v => set('email', v)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                style={inputStyle(focused, 'email')}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={labelStyle}>Contact Number</Text>
              <TextInput
                value={form.contact_number}
                onChangeText={v => set('contact_number', v)}
                onFocus={() => setFocused('contact_number')}
                onBlur={() => setFocused(null)}
                placeholder="09xxxxxxxxx"
                placeholderTextColor={COLORS.textLight}
                keyboardType="phone-pad"
                style={inputStyle(focused, 'contact_number')}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={labelStyle}>Birthdate</Text>
              <TextInput
                value={form.birthdate}
                onChangeText={v => set('birthdate', v)}
                onFocus={() => setFocused('birthdate')}
                onBlur={() => setFocused(null)}
                placeholder="YYYY-MM-DD (e.g. 1998-05-20)"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numbers-and-punctuation"
                style={inputStyle(focused, 'birthdate')}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={labelStyle}>Sex</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SexButton val="male"   label="Male"   />
                <SexButton val="female" label="Female" />
                <SexButton val="other"  label="Other"  />
              </View>
            </View>

            {/* ── Documents ── */}
            <Text style={sectionTitle}>Required Documents</Text>

            <View style={{ marginBottom: 14 }}>
              <Text style={labelStyle}>Driver's License</Text>
              <FileButton
                label="Upload Driver's License"
                file={licenseFile}
                onPress={() => pickImage(setLicenseFile)}
              />
            </View>

            <View style={{ marginBottom: 28 }}>
              <Text style={labelStyle}>Motorcycle Registration</Text>
              <FileButton
                label="Upload Motorcycle Registration"
                file={regFile}
                onPress={() => pickImage(setRegFile)}
              />
            </View>

            {/* ── Password ── */}
            <Text style={sectionTitle}>Set Password</Text>

            <View style={{ marginBottom: 16 }}>
              <Text style={labelStyle}>Password</Text>
              <View>
                <TextInput
                  value={form.password}
                  onChangeText={v => set('password', v)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={COLORS.textLight}
                  secureTextEntry={!showPw}
                  style={inputStyle(focused, 'password')}
                />
              </View>
            </View>

            <View style={{ marginBottom: 32 }}>
              <Text style={labelStyle}>Confirm Password</Text>
              <TextInput
                value={form.confirm_password}
                onChangeText={v => set('confirm_password', v)}
                onFocus={() => setFocused('confirm_password')}
                onBlur={() => setFocused(null)}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.textLight}
                secureTextEntry={!showPw}
                style={inputStyle(focused, 'confirm_password')}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600' }}>
                  {showPw ? 'Hide password' : 'Show password'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: 'center',
                opacity: loading ? 0.7 : 1,
                ...SHADOWS.md,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Submit Application</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/login')} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>
                Already have an account?{' '}
                <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
