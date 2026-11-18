import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Btn, Card, Icon, Input, Muted, Screen, SectionTitle, s } from '@/components/wallet-ui';
import { useWallet } from '@/lib/wallet-store';

export default function RegisterScreen() {
  const { register } = useWallet();
  const [f, setF] = useState({ name: '', username: '', email: '', phone: '', password: '', confirm: '', mpin: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const submit = async () => {
    const username = f.username.trim().toLowerCase();
    if (!f.name.trim() || !username) return Alert.alert('Missing details', 'Enter your full name and a username.');
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) return Alert.alert('Invalid username', 'Use 3–20 letters, numbers, dots or underscores.');
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return Alert.alert('Check your email', 'That email address does not look right.');
    if (f.password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
    if (f.password !== f.confirm) return Alert.alert('Passwords do not match', 'Re-enter the same password in both fields.');
    if (!/^\d{6}$/.test(f.mpin)) return Alert.alert('Invalid MPIN', 'Your MPIN must be exactly 6 digits.');
    setBusy(true);
    const res = await register({ name: f.name, username, password: f.password, mpin: f.mpin, email: f.email.trim() || undefined, phone: f.phone.trim() || undefined });
    setBusy(false);
    if (!res.ok) return Alert.alert('Could not create account', res.error);
    Alert.alert('Account created', `You can now log in as @${username}. Add a photo and more details any time under Profile.`);
    router.back();
  };

  return (
    <Screen>
      <SectionTitle>About you</SectionTitle>
      <Card>
        <Input icon="person-outline" label="Full name" placeholder="Juan Dela Cruz" autoCapitalize="words" value={f.name} onChangeText={set('name')} />
        <Input icon="mail-outline" label="Email (optional)" placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={f.email} onChangeText={set('email')} />
        <Input icon="call-outline" label="Mobile number (optional)" placeholder="0917 123 4567" keyboardType="phone-pad" value={f.phone} onChangeText={set('phone')} />
      </Card>

      <SectionTitle>Sign-in details</SectionTitle>
      <Card>
        <Input icon="at-outline" label="Username" placeholder="juandc" autoCapitalize="none" autoCorrect={false} value={f.username} onChangeText={set('username')} />
        <Input icon="lock-closed-outline" label="Password" placeholder="6+ characters" secureTextEntry value={f.password} onChangeText={set('password')} />
        <Input icon="lock-closed-outline" label="Confirm password" secureTextEntry value={f.confirm} onChangeText={set('confirm')} />
        <Input icon="keypad-outline" label="MPIN" placeholder="6 digits" secureTextEntry keyboardType="number-pad" maxLength={6} value={f.mpin} onChangeText={set('mpin')} />
      </Card>

      <Btn label="Create account" onPress={submit} loading={busy} />
      <View style={[s.rowCenter, { gap: 8, alignItems: 'flex-start', marginTop: 6 }]}>
        <Icon name="information-circle-outline" size={18} color="#64748B" />
        <Muted style={{ flex: 1 }}>Your MPIN approves logins and payments. Never share it. CiCo staff will never ask for it.</Muted>
      </View>
    </Screen>
  );
}
