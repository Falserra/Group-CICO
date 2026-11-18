// Home: balance, quick actions, security summary and recent activity.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TxRow } from '@/components/tx-row';
import { Alert } from '@/lib/alert';
import { Avatar, Btn, C, Card, Empty, Hero, Icon, IconBubble, ListRow, Muted, QuickAction, Screen, SectionTitle, VerifiedBadge, peso, s } from '@/components/wallet-ui';
import { useScreenSharingProtection } from '@/lib/security-layer';
import { useMe, useWallet } from '@/lib/wallet-store';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function HomeScreen() {
  const me = useMe();
  const { transactions, notifications, subscriptions, emergencyFreeze, markRead } = useWallet();
  const protectedShare = useScreenSharingProtection();
  const [hidden, setHidden] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  const frozen = me.status === 'frozen';
  const activeSubs = subscriptions.filter((x) => x.status === 'active').length;
  // An unread warning (e.g. a transfer you didn't make) surfaces here with a Freeze button.
  const alert = frozen ? undefined : notifications.find((n) => n.kind === 'warning' && !n.read);

  // FR-05: one tap freezes the wallet (applied immediately) and files a timestamped fraud ticket.
  const freeze = async () => {
    setFreezing(true);
    const res = await emergencyFreeze();
    setFreezing(false);
    if (!res.ok) return Alert.alert('Could not freeze your wallet', `${res.error} Try again, or call the Security Team.`);
    if (alert) markRead(alert.id);
    Alert.alert('Wallet frozen', `Locked in ${(res.ms / 1000).toFixed(2)} s. All outgoing money is blocked. A fraud ticket was sent to the Security Team for review within 24 hours.`);
  };

  const confirmFreeze = () =>
    Alert.alert('Freeze your wallet?', 'No money can leave your account until the Security Team unlocks it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Freeze now', style: 'destructive', onPress: freeze },
    ]);

  const safetyBits = [me.biometricEnabled ? 'Biometric login on' : 'Biometric login off', protectedShare ? 'Screen-share shield on' : `${activeSubs} auto-debit${activeSubs === 1 ? '' : 's'}`];

  return (
    <Screen flush>
      <Hero>
        <View style={[s.rowCenter, { justifyContent: 'space-between' }]}>
          <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Open my profile" style={[s.rowCenter, { gap: 12, flexShrink: 1 }]}>
            <Avatar name={me.name} path={me.profile.avatar} size={44} ring />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: '#BFD3F2', fontSize: 13 }}>{greeting()}</Text>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }} numberOfLines={1}>
                {me.name.split(' ')[0]}
              </Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={12} accessibilityLabel={`Notifications, ${unread} unread`}>
            <Icon name="notifications-outline" size={26} color="#fff" />
            {unread > 0 && (
              <View style={{ position: 'absolute', top: -5, right: -6, backgroundColor: C.accent, borderRadius: 10, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' }}>
                <Text style={{ color: C.primaryDark, fontSize: 11, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 20, marginTop: -44 }}>
        <Card style={{ paddingVertical: 20 }}>
          <View style={[s.rowCenter, { justifyContent: 'space-between' }]}>
            <Text style={{ color: C.mute, fontWeight: '600' }}>Available balance</Text>
            <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
              <Icon name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.mute} />
            </Pressable>
          </View>
          <Text style={{ color: C.ink, fontSize: 36, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 }}>{hidden ? '₱ ••••••' : peso(me.balance)}</Text>
          <View style={[s.rowCenter, { justifyContent: 'space-between', marginTop: 10 }]}>
            <Text style={{ color: C.mute }}>CiCo Wallet · @{me.username}</Text>
            <VerifiedBadge verified={me.verified} />
          </View>
        </Card>

        {frozen && (
          <Card style={{ backgroundColor: C.dangerBg, flexDirection: 'row', gap: 12 }}>
            <Icon name="lock-closed" size={24} color={C.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.danger, fontWeight: '800', fontSize: 16 }}>Account frozen</Text>
              <Text style={{ color: C.danger, marginTop: 4, lineHeight: 20 }}>Sending, paying and topping up are disabled while the Security Team reviews your case. You&apos;ll be notified when it is unlocked.</Text>
            </View>
          </Card>
        )}

        {alert && (
          <Card style={{ backgroundColor: C.dangerBg, borderWidth: 2, borderColor: C.danger }}>
            <View style={[s.rowCenter, { gap: 8 }]}>
              <Icon name="warning" size={20} color={C.danger} />
              <Text style={{ color: C.danger, fontWeight: '800', fontSize: 16 }}>Did you make this transfer?</Text>
            </View>
            <Text style={{ color: C.danger, marginTop: 6, marginBottom: 10, lineHeight: 20 }}>{alert.message}</Text>
            <Btn label="Not me — freeze my wallet" variant="danger" icon="snow" onPress={freeze} loading={freezing} />
            <Btn label="It was me" variant="ghost" onPress={() => markRead(alert.id)} />
          </Card>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <QuickAction icon="arrow-up" label="Send" disabled={frozen} onPress={() => router.push({ pathname: '/transact', params: { type: 'send' } })} />
          <QuickAction icon="receipt-outline" label="Pay bills" disabled={frozen} onPress={() => router.push({ pathname: '/transact', params: { type: 'bill' } })} />
          <QuickAction icon="add" label="Top up" disabled={frozen} onPress={() => router.push({ pathname: '/transact', params: { type: 'topup' } })} />
          <QuickAction icon="qr-code-outline" label="Scan QR" disabled={frozen} onPress={() => router.push('/qr')} />
        </View>

        <Pressable onPress={() => router.push('/security')} style={({ pressed }) => [s.row, { backgroundColor: C.primarySoft, shadowOpacity: 0 }, pressed && { opacity: 0.8 }]}>
          <IconBubble name="shield-checkmark" color="#fff" bg={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.rowT}>Security center</Text>
            <Text style={s.rowS}>{safetyBits.join(' · ')}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={C.primary} />
        </Pressable>

        <SectionTitle action={transactions.length ? 'See all' : undefined} onAction={() => router.push('/history')}>
          Recent activity
        </SectionTitle>
        {transactions.length === 0 ? (
          <Empty icon="wallet-outline" text="No transactions yet. Link a bank account or card, then top up to get started." />
        ) : (
          transactions.slice(0, 4).map((t) => <TxRow key={t.id} tx={t} onPress={() => router.push({ pathname: '/report', params: { transactionId: t.id } })} />)
        )}
        {transactions.length === 0 && <ListRow icon="link-outline" title="Link a bank account or card" subtitle="Needed to top up your wallet" chevron onPress={() => router.push('/link-account')} />}

        {!frozen && (
          <View style={{ marginTop: 14 }}>
            <Btn label="Emergency freeze" variant="danger" icon="snow" onPress={confirmFreeze} loading={freezing} />
            <Muted style={{ textAlign: 'center' }}>Being scammed right now? One tap locks your wallet instantly.</Muted>
          </View>
        )}
      </View>
    </Screen>
  );
}
