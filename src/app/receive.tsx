// Receive Money: show a QR code (and username) that another CiCo user can scan to pay you.
import QRCode from 'react-native-qrcode-svg';
import { Share, Text, View } from 'react-native';

import { Avatar, Btn, C, Card, Muted, Screen, VerifiedBadge } from '@/components/wallet-ui';
import { buildQr } from '@/lib/qr';
import { useMe } from '@/lib/wallet-store';

export default function ReceiveScreen() {
  const me = useMe();
  // Merchants name their store in the code so scanners can detect a sticker pasted over it.
  const code = buildQr({ to: me.username, merchant: me.kind === 'merchant' ? me.name : undefined });
  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Avatar name={me.name} path={me.profile.avatar} size={64} />
        <Text style={{ color: C.ink, fontWeight: '800', fontSize: 20, marginTop: 10 }}>{me.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Text style={{ color: C.mute, fontSize: 15 }}>@{me.username}</Text>
          <VerifiedBadge verified={me.verified} />
        </View>
        <View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.line, marginTop: 18 }}>
          <QRCode value={code} size={210} color={C.ink} backgroundColor="#fff" />
        </View>
        <Muted style={{ marginTop: 14, textAlign: 'center' }}>Ask the sender to scan this code in CiCo, or to pay @{me.username} by username.</Muted>
      </Card>
      <Btn label="Share my details" variant="soft" icon="share-social-outline" onPress={() => Share.share({ message: `Send money to my CiCo wallet: @${me.username} (${me.name})` })} />
      <Muted style={{ marginTop: 6 }}>
        Senders see your name{me.verified ? ' and a verified badge' : ''} before they confirm, so they know the money is going to the right person. You never need to share your MPIN or OTP to receive money.
      </Muted>
    </Screen>
  );
}
