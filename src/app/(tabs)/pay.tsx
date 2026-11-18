// Pay & Transfer hub: everything that moves money, in one place.
import { router } from 'expo-router';

import { C, Card, H1, ListRow, Muted, Screen, SectionTitle, Icon } from '@/components/wallet-ui';
import { useMe, useWallet } from '@/lib/wallet-store';
import { Text, View } from 'react-native';

export default function PayScreen() {
  const me = useMe();
  const { paymentMethods } = useWallet();
  const frozen = me.status === 'frozen';
  const go = (type: 'send' | 'bill' | 'topup') => () => router.push({ pathname: '/transact', params: { type } });

  return (
    <Screen bare>
      <H1>Pay &amp; Transfer</H1>
      {frozen && (
        <Card style={{ backgroundColor: C.dangerBg, flexDirection: 'row', gap: 10 }}>
          <Icon name="lock-closed" size={20} color={C.danger} />
          <Text style={{ color: C.danger, flex: 1 }}>Your account is frozen. Money movement is disabled until the Security Team unlocks it.</Text>
        </Card>
      )}

      <SectionTitle>Send &amp; pay</SectionTitle>
      <ListRow icon="arrow-up" title="Send money" subtitle="Pay anyone with a CiCo username" chevron onPress={frozen ? undefined : go('send')} />
      <ListRow icon="receipt-outline" title="Pay bills" subtitle="Electricity, water, internet, tuition" chevron onPress={frozen ? undefined : go('bill')} />
      <ListRow icon="qr-code-outline" title="Scan to pay" subtitle="Checked for fake stickers before you pay" chevron onPress={frozen ? undefined : () => router.push('/qr')} />

      <SectionTitle>Add &amp; receive</SectionTitle>
      <ListRow icon="add" title="Top up wallet" subtitle={paymentMethods.length ? `From ${paymentMethods.length} linked account${paymentMethods.length === 1 ? '' : 's'}` : 'Link an account first'} chevron onPress={frozen ? undefined : go('topup')} />
      <ListRow icon="arrow-down" title="Receive money" subtitle="Show your QR code or username" chevron onPress={() => router.push('/receive')} />
      <ListRow icon="link-outline" title="Linked accounts" subtitle="Banks and cards used for top up" chevron onPress={() => router.push('/link-account')} />

      <View style={{ marginTop: 8 }}>
        <Muted>CiCo checks every payment for scam warning signs before you confirm, and shows a clear risk level on the review screen.</Muted>
      </View>
    </Screen>
  );
}
