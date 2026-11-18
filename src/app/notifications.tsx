import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { C, Empty, IconBubble, Screen, formatDate, s, type IconName } from '@/components/wallet-ui';
import { useWallet } from '@/lib/wallet-store';

const LOOK: Record<'info' | 'success' | 'warning' | 'security', { icon: IconName; color: string; bg: string }> = {
  info: { icon: 'information-circle', color: C.primary, bg: C.primarySoft },
  success: { icon: 'checkmark-circle', color: C.success, bg: C.successBg },
  warning: { icon: 'warning', color: C.warn, bg: C.warnBg },
  security: { icon: 'shield-checkmark', color: C.primary, bg: C.primarySoft },
};

export default function NotificationsScreen() {
  const { notifications, markAllRead } = useWallet();
  // Show unread dots while the screen is open; mark everything read when leaving.
  useEffect(() => () => {
    markAllRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      {notifications.length === 0 ? (
        <Empty icon="notifications-off-outline" text="You're all caught up." />
      ) : (
        notifications.map((n) => {
          const look = LOOK[n.kind];
          return (
            <View key={n.id} style={s.row}>
              <IconBubble name={look.icon} color={look.color} bg={look.bg} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: n.read ? '400' : '700', lineHeight: 20 }}>{n.message}</Text>
                <Text style={s.rowS}>{formatDate(n.timestamp)}</Text>
              </View>
              {!n.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent }} />}
            </View>
          );
        })
      )}
    </Screen>
  );
}
