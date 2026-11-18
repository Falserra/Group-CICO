// Activity (Figure 7): every transaction, grouped by day. Tap one to report it.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { TxRow, isIncoming } from '@/components/tx-row';
import { C, Card, Chip, Empty, H1, Muted, Screen, SectionTitle, dayLabel, peso, s } from '@/components/wallet-ui';
import type { TxType } from '@/lib/types';
import { useWallet } from '@/lib/wallet-store';

const FILTERS: { key: 'all' | TxType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'send', label: 'Sent' },
  { key: 'receive', label: 'Received' },
  { key: 'bill', label: 'Bills' },
  { key: 'topup', label: 'Top ups' },
];

export default function HistoryScreen() {
  const { transactions } = useWallet();
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const list = filter === 'all' ? transactions : transactions.filter((t) => t.type === filter);

  // Money in / out for the current month (completed transactions only).
  const now = new Date();
  const thisMonth = transactions.filter((t) => t.status === 'completed' && new Date(t.timestamp).getMonth() === now.getMonth() && new Date(t.timestamp).getFullYear() === now.getFullYear());
  const moneyIn = thisMonth.filter(isIncoming).reduce((sum, t) => sum + t.amount, 0);
  const moneyOut = thisMonth.filter((t) => !isIncoming(t)).reduce((sum, t) => sum + t.amount, 0);

  const groups: { day: string; items: typeof list }[] = [];
  for (const t of list) {
    const day = dayLabel(t.timestamp);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(t);
    else groups.push({ day, items: [t] });
  }

  return (
    <Screen bare>
      <H1>Activity</H1>
      <Card style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>In this month</Text>
          <Text style={{ color: C.success, fontSize: 20, fontWeight: '800' }}>{peso(moneyIn)}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: C.line, marginHorizontal: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Out this month</Text>
          <Text style={{ color: C.ink, fontSize: 20, fontWeight: '800' }}>{peso(moneyOut)}</Text>
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>

      {list.length === 0 ? (
        <Empty icon="receipt-outline" text="No transactions yet." />
      ) : (
        groups.map((g) => (
          <View key={g.day}>
            <SectionTitle>{g.day}</SectionTitle>
            {g.items.map((t) => (
              <TxRow key={t.id} tx={t} showRisk onPress={() => router.push({ pathname: '/report', params: { transactionId: t.id } })} />
            ))}
          </View>
        ))
      )}
      {list.length > 0 && <Muted style={{ textAlign: 'center', marginTop: 8 }}>Don&apos;t recognise a transaction? Tap it to report it.</Muted>}
    </Screen>
  );
}
