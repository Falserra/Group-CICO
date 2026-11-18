// Login (Figure 3 / Figure 10): credentials → MPIN or biometric second factor → dashboard.
import * as LocalAuthentication from 'expo-local-authentication';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Btn, C, Card, Hero, Icon, IconBubble, Input, Muted, Screen, s } from '@/components/wallet-ui';
import { useWallet } from '@/lib/wallet-store';

type Pending = { token: string; name: string; biometricEnabled: boolean }; // password accepted, MPIN still needed

export default function LoginScreen() {
  const { validateCredentials, finishLogin, lastRegistered, rememberedUsername, setRememberedUsername } = useWallet();
  const [saved] = useState(rememberedUsername);
  const [username, setUsername] = useState(lastRegistered ?? saved ?? '');
  const [remember, setRemember] = useState(!!saved);
  const [password, setPassword] = useState('');
  const [found, setFound] = useState<Pending | null>(null);
  const [mpin, setMpin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!username.trim() || !password) return Alert.alert('Missing details', 'Enter your username and password.');
    setBusy(true);
    const res = await validateCredentials(username, password);
    setBusy(false);
    if (!res.ok) return Alert.alert('Login failed', res.error);
    setRememberedUsername(remember ? username.trim().toLowerCase().replace(/^@/, '') : null);
    setFound(res.pending);
    setPassword('');
    if (res.pending.biometricEnabled) tryBiometric(res.pending);
  };

  // On success the session starts and the root layout moves to the dashboard on its own.
  const complete = async (pending: Pending, factor: { mpin: string } | { biometric: true }) => {
    setBusy(true);
    const res = await finishLogin(pending.token, factor);
    setBusy(false);
    if (res.ok) return;
    setMpin('');
    if (/timed out/i.test(res.error)) setFound(null); // the 5-minute window passed: start again
    Alert.alert('Authentication failed', res.error);
  };

  const verify = () => {
    if (found && !busy) complete(found, { mpin });
  };

  async function tryBiometric(pending: Pending) {
    const available = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    if (!available) return Alert.alert('Biometrics unavailable', 'Use your 6-digit MPIN instead.');
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Log in to CiCo', cancelLabel: 'Use MPIN', disableDeviceFallback: true });
    if (r.success) complete(pending, { biometric: true });
  }

  return (
    <Screen flush>
      <Hero style={{ paddingBottom: 84 }}>
        <View style={{ alignItems: 'center', paddingTop: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield-checkmark" size={36} color={C.primaryDark} />
          </View>
          <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 12 }}>CiCo</Text>
          <Text style={{ color: '#BFD3F2', marginTop: 2, fontSize: 15 }}>Your wallet, watched over.</Text>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 20, marginTop: -52 }}>
        {!found ? (
          <>
            <Card style={{ paddingTop: 20 }}>
              <Text style={[s.h2, { fontSize: 20 }]}>Log in</Text>
              <Muted style={{ marginBottom: 16 }}>Enter your username and password.</Muted>
              <Input icon="person-outline" placeholder="Username" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
              <Input icon="lock-closed-outline" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
              <View style={[s.rowCenter, { justifyContent: 'space-between', marginBottom: 10 }]}>
                <Text style={{ color: C.ink }}>Remember my username</Text>
                <Switch value={remember} onValueChange={setRemember} trackColor={{ true: C.primary, false: '#CBD5E1' }} thumbColor="#fff" />
              </View>
              <Btn label="Log in" onPress={submit} loading={busy} />
            </Card>
            <View style={{ alignItems: 'center', gap: 2, marginTop: 4 }}>
              <Muted>New to CiCo?</Muted>
              <Link href="/register" style={{ color: C.primary, fontWeight: '800', fontSize: 16, paddingVertical: 6 }}>
                Create an account
              </Link>
            </View>
          </>
        ) : (
          <Card style={{ paddingTop: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <IconBubble name="keypad-outline" size={56} />
            </View>
            <Text style={[s.h2, { fontSize: 20, textAlign: 'center' }]}>Hi {found.name.split(' ')[0]}</Text>
            <Muted style={{ textAlign: 'center', marginBottom: 16 }}>Enter your 6-digit MPIN to continue.</Muted>
            <Input icon="keypad-outline" placeholder="6-digit MPIN" secureTextEntry keyboardType="number-pad" maxLength={6} value={mpin} onChangeText={setMpin} onSubmitEditing={verify} autoFocus />
            <Btn label="Verify" onPress={verify} disabled={mpin.length !== 6} loading={busy} />
            {found.biometricEnabled && <Btn label="Use fingerprint / Face ID" variant="soft" icon="finger-print" onPress={() => tryBiometric(found)} />}
            <Btn
              label="Back"
              variant="ghost"
              onPress={() => {
                setFound(null);
                setMpin('');
              }}
            />
          </Card>
        )}

        <View style={[s.rowCenter, { justifyContent: 'center', gap: 6, marginTop: 20 }]}>
          <Icon name="lock-closed" size={14} color={C.mute} />
          <Muted style={{ fontSize: 12.5 }}>CiCo will never ask for your OTP or MPIN.</Muted>
        </View>
      </View>
    </Screen>
  );
}
