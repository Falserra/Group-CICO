// Security center: sign-in protection, scam tools and the emergency freeze, in one place.
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Btn, C, Card, H1, IconBubble, ListRow, Muted, Screen, SectionTitle, ToggleRow, s } from '@/components/wallet-ui';
import { setScreenSharingProtection, useScreenSharingProtection } from '@/lib/security-layer';
import { useMe, useWallet } from '@/lib/wallet-store';

export default function SecurityScreen() {
  const me = useMe();
  const { setBiometric, subscriptions, emergencyFreeze } = useWallet();
  const shield = useScreenSharingProtection();
  const [freezing, setFreezing] = useState(false);
  const frozen = me.status === 'frozen';
  const autoDebits = subscriptions.filter((x) => x.status === 'active').length;

  const applyBiometric = async (on: boolean) => {
    const res = await setBiometric(on);
    if (!res.ok) Alert.alert('Could not change this setting', res.error);
  };
  const toggleBiometric = async (on: boolean) => {
    if (!on) return applyBiometric(false);
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
    if (!enrolled) return Alert.alert('Biometrics not set up', 'Add a fingerprint or Face ID in your phone settings first.');
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable biometric login' });
    if (r.success) applyBiometric(true);
  };

  const freeze = () =>
    Alert.alert('Freeze your wallet?', 'No money can leave your account until the Security Team unlocks it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Freeze now',
        style: 'destructive',
        onPress: async () => {
          setFreezing(true);
          const res = await emergencyFreeze();
          setFreezing(false);
          if (res.ok) Alert.alert('Wallet frozen', `Locked in ${(res.ms / 1000).toFixed(2)} s. A fraud ticket was sent to the Security Team.`);
          else Alert.alert('Could not freeze your wallet', res.error);
        },
      },
    ]);

  return (
    <Screen bare>
      <H1>Security</H1>

      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: frozen ? C.dangerBg : C.primarySoft }}>
        <IconBubble name={frozen ? 'lock-closed' : 'shield-checkmark'} color="#fff" bg={frozen ? C.danger : C.primary} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: frozen ? C.danger : C.ink, fontWeight: '800', fontSize: 17 }}>{frozen ? 'Account frozen' : 'Your wallet is protected'}</Text>
          <Text style={{ color: frozen ? C.danger : C.mute, marginTop: 2 }}>{frozen ? 'The Security Team is reviewing your case.' : 'CiCo checks every payment, link and QR code for scams.'}</Text>
        </View>
      </Card>

      <SectionTitle>Sign-in &amp; privacy</SectionTitle>
      <ToggleRow icon="finger-print" title="Fingerprint / Face ID" subtitle="Log in with biometrics instead of your MPIN" value={me.biometricEnabled} onChange={toggleBiometric} />
      <ToggleRow
        icon="videocam-outline"
        title="Screen-sharing protection"
        subtitle="Turn on during a video call. Your OTP stays hidden until you press and hold."
        value={shield}
        onChange={setScreenSharingProtection}
      />
      <ListRow icon="key-outline" title="Password &amp; MPIN" subtitle="Change how you sign in" chevron onPress={() => router.push('/profile')} />

      <SectionTitle>Scam protection</SectionTitle>
      <ListRow icon="link-outline" title="Check a link or text message" subtitle="Spot phishing before you tap" chevron onPress={() => router.push('/scan')} />
      <ListRow icon="repeat-outline" title="Subscription Hub" subtitle={`${autoDebits} active auto-deduction${autoDebits === 1 ? '' : 's'}`} chevron onPress={() => router.push('/subscriptions')} />
      <ListRow icon="flag-outline" title="Report suspicious activity" subtitle="Send a fraud ticket to the Security Team" chevron onPress={() => router.push('/report')} />

      {!frozen && (
        <>
          <SectionTitle>Emergency</SectionTitle>
          <Card style={{ borderWidth: 1.5, borderColor: C.dangerBg }}>
            <Text style={[s.h2, { color: C.danger }]}>Emergency freeze</Text>
            <Muted style={{ marginBottom: 12 }}>Being scammed right now? One tap locks your wallet instantly and alerts the Security Team.</Muted>
            <Btn label="Freeze my wallet" variant="danger" icon="snow" onPress={freeze} loading={freezing} />
          </Card>
        </>
      )}
      <Muted style={{ textAlign: 'center', marginTop: 4 }}>CiCo will never ask for your OTP or MPIN, and never asks you to share your screen.</Muted>
    </Screen>
  );
}
