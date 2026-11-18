// Scan to pay (FR-03, fake-QR protection): before any money moves, the
// scanner compares the store name printed in the QR with the account it actually pays
// and shows a colour-coded verdict inline.
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Btn, C, Card, Muted, RiskIndicator, Screen, VerifiedBadge, s } from '@/components/wallet-ui';
import { parseQr, type QrPayload } from '@/lib/qr';
import { isMerchantMismatch } from '@/lib/verification';
import { useMe, useWallet } from '@/lib/wallet-store';

export default function QrScreen() {
  const me = useMe();
  const { accountByUsername, verifyTransaction, submitReport } = useWallet();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [scanned, setScanned] = useState<QrPayload | null>(null);
  const locked = useRef(false); // the camera fires many times per second

  // Only one camera preview can run at a time; release it when this screen is hidden.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const recipient = scanned ? accountByUsername(scanned.to) : undefined;
  const check = scanned ? verifyTransaction({ type: 'send', amount: scanned.amount ?? 0, recipientUsername: scanned.to, qrMerchant: scanned.merchant }) : null;
  const mismatch = !!scanned && !!recipient && isMerchantMismatch({ qrMerchantClaim: scanned.merchant, recipientName: recipient.name, recipientIsMerchant: recipient.kind === 'merchant' });

  const handle = (data: string) => {
    if (locked.current) return;
    locked.current = true;
    const p = parseQr(data);
    if (!p) {
      Alert.alert('Not a CiCo payment code', 'This QR code is not a CiCo payment request. Ask the store for their CiCo QR.', [{ text: 'OK', onPress: () => (locked.current = false) }]);
      return;
    }
    setScanned(p);
  };

  const rescan = () => {
    setScanned(null);
    locked.current = false;
  };

  const cancelAndReport = () => {
    if (!scanned) return;
    submitReport({ description: `Fake QR code: the code at "${scanned.merchant ?? 'unknown store'}" pays @${scanned.to}${recipient ? ` (${recipient.name})` : ''}.` });
    Alert.alert('Payment stopped', 'Nothing was sent. We reported this QR code to the Security Team. Tell the cashier their QR may have been covered by a fake sticker.');
    router.back();
  };

  const proceed = () => {
    if (!scanned) return;
    router.replace({ pathname: '/transact', params: { type: 'send', to: scanned.to, merchant: scanned.merchant ?? '', amount: scanned.amount ? String(scanned.amount) : '' } });
  };

  if (scanned && check) {
    return (
      <Screen>
        <Card>
          <Text style={s.label}>QR code says you are paying</Text>
          <Text style={{ color: C.ink, fontWeight: '800', fontSize: 20, marginBottom: 10 }}>{scanned.merchant ?? 'No store name in this code'}</Text>
          <Text style={s.label}>Money will actually go to</Text>
          {recipient && recipient.id !== me.id ? (
            <>
              <View style={[s.rowCenter, { gap: 8 }]}>
                <Text style={{ color: mismatch ? C.danger : C.ink, fontWeight: '800', fontSize: 20 }}>{recipient.name}</Text>
                <VerifiedBadge verified={recipient.verified} />
              </View>
              <Muted>
                @{recipient.username} · {recipient.kind === 'merchant' ? 'Registered merchant' : 'Personal account'}
              </Muted>
            </>
          ) : (
            <Text style={{ color: C.danger, fontWeight: '700' }}>No CiCo account matches this code</Text>
          )}
        </Card>

        {mismatch && (
          <Card style={{ backgroundColor: C.dangerBg, borderWidth: 2, borderColor: C.danger }}>
            <Text style={{ color: C.danger, fontWeight: '800', fontSize: 17 }}>Merchant mismatch</Text>
            <Text style={{ color: C.danger, marginTop: 4, lineHeight: 20 }}>
              Counter is “{scanned.merchant}”, but this QR pays “{recipient?.name}”. Scammers stick fake QR codes over real ones. Pay at the cashier instead.
            </Text>
          </Card>
        )}
        <RiskIndicator level={check.level} reasons={check.reasons} />

        {mismatch || !recipient ? (
          <>
            <Btn label="Cancel and report this QR" variant="danger" onPress={cancelAndReport} />
            {recipient && <Btn label="I trust it — continue" variant="ghost" onPress={proceed} />}
          </>
        ) : (
          <Btn label={`Continue to pay ${recipient.name}`} onPress={proceed} />
        )}
        <Btn label="Scan again" variant="ghost" onPress={rescan} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ padding: 0, overflow: 'hidden', height: 320, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        {!permission ? null : !permission.granted ? (
          <View style={{ padding: 20, alignSelf: 'stretch' }}>
            <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>CiCo needs your camera to scan payment QR codes.</Text>
            <Btn label="Allow camera" variant="teal" onPress={requestPermission} />
          </View>
        ) : focused ? (
          <CameraView style={{ flex: 1, alignSelf: 'stretch' }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(r: BarcodeScanningResult) => handle(r.data)} />
        ) : null}
      </Card>
      <Muted style={{ textAlign: 'center', marginBottom: 16 }}>Point your camera at the store&apos;s CiCo QR code.</Muted>

      <Btn label="Pay by username instead" variant="soft" icon="at-outline" onPress={() => router.replace({ pathname: '/transact', params: { type: 'send' } })} />
    </Screen>
  );
}
