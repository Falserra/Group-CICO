// Bottom tab bar for signed-in customers.
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, Icon, type IconName } from '@/components/wallet-ui';

const TABS: { name: string; title: string; on: IconName; off: IconName }[] = [
  { name: 'home', title: 'Home', on: 'home', off: 'home-outline' },
  { name: 'pay', title: 'Pay', on: 'swap-horizontal', off: 'swap-horizontal-outline' },
  { name: 'history', title: 'Activity', on: 'receipt', off: 'receipt-outline' },
  { name: 'security', title: 'Security', on: 'shield-checkmark', off: 'shield-checkmark-outline' },
  { name: 'profile', title: 'Profile', on: 'person', off: 'person-outline' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.line, height: 62 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 6 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{ title: t.title, tabBarIcon: ({ color, focused }) => <Icon name={focused ? t.on : t.off} size={24} color={String(color)} /> }}
        />
      ))}
    </Tabs>
  );
}
