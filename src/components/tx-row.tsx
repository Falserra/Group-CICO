// One line in a transaction list: type icon, who/what, when, and the signed amount.
import { Text, View } from 'react-native';

import { C, ListRow, formatDate, peso, type IconName } from '@/components/wallet-ui';
import type { Transaction, TxType } from '@/lib/types';
import { RISK_COPY } from '@/lib/verification';

const VERB: Record<TxType, string> = { send: 'Sent to', receive: 'Received from', bill: 'Paid', topup: 'Top up from' };
const ICON: Record<TxType, IconName> = { send: 'arrow-up', receive: 'arrow-down', bill: 'receipt-outline', topup: 'add' };

export const isIncoming = (t: Pick<Transaction, 'type'>) => t.type === 'receive' || t.type === 'topup';

export function TxRow({ tx, onPress, showRisk }: { tx: Transaction; onPress?: () => void; showRisk?: boolean }) {
  const incoming = isIncoming(tx);
  const done = tx.status === 'completed';
  const tone = incoming ? C.success : C.ink;
  return (
    <ListRow
      icon={ICON[tx.type]}
      iconColor={incoming ? C.success : C.primary}
      iconBg={incoming ? C.successBg : C.primarySoft}
      title={`${VERB[tx.type]} ${tx.counterparty}`}
      subtitle={`${formatDate(tx.timestamp)}${done ? '' : ` · ${tx.status}`}${tx.note ? ` · “${tx.note}”` : ''}`}
      onPress={onPress}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: '800', color: done ? tone : C.mute, textDecorationLine: done ? 'none' : 'line-through' }}>
            {incoming ? '+' : '−'}
            {peso(tx.amount)}
          </Text>
          {showRisk && tx.risk !== 'green' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: RISK_COPY[tx.risk].color, marginRight: 4 }} />
              <Text style={{ fontSize: 11, color: C.mute }}>{RISK_COPY[tx.risk].label}</Text>
            </View>
          )}
        </View>
      }
    />
  );
}
