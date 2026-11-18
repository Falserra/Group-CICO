// Administrator dashboard (Figure 9 / Figure 14): review reports, freeze/unlock accounts,
// monitor flagged transactions. Same "displayDashboard" entry point as customers, different view.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Avatar, Btn, C, Card, Chip, Empty, Hero, Icon, Muted, Screen, SectionTitle, formatDate, peso, s } from '@/components/wallet-ui';
import { RISK_COPY } from '@/lib/verification';
import { useWallet } from '@/lib/wallet-store';

type Tab = 'reports' | 'accounts' | 'flagged';

export default function AdminScreen() {
  const { me, accounts, reports, allTransactions, accountById, reviewReport, setAccountStatus, logout } = useWallet();
  const [tab, setTab] = useState<Tab>('reports');

  const pending = reports.filter((r) => r.status === 'pending').sort((a, b) => Number(b.emergency) - Number(a.emergency) || a.timestamp - b.timestamp);
  const closed = reports.filter((r) => r.status !== 'pending');
  const customers = accounts.filter((a) => a.role === 'customer');
  const flagged = allTransactions.filter((t) => t.risk !== 'green' && t.type !== 'receive');

  const confirmFreeze = (reportId: string, name: string) =>
    Alert.alert('Freeze account?', `${name} will not be able to move money until unlocked.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Freeze', style: 'destructive', onPress: () => reviewReport(reportId, 'freeze') },
    ]);

  return (
    <Screen flush>
      <Hero>
        <View style={[s.rowCenter, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={{ color: '#BFD3F2', fontSize: 13 }}>Signed in as {me?.name}</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Security console</Text>
          </View>
          <Pressable onPress={logout} hitSlop={12} accessibilityLabel="Log out">
            <Icon name="log-out-outline" size={26} color="#fff" />
          </Pressable>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 20, marginTop: -44 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Stat label="Pending reports" value={pending.length} alert={pending.some((r) => r.emergency)} />
          <Stat label="Frozen accounts" value={customers.filter((a) => a.status === 'frozen').length} />
          <Stat label="Flagged txns" value={flagged.length} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label={`Reports (${pending.length})`} active={tab === 'reports'} onPress={() => setTab('reports')} />
          <Chip label="Accounts" active={tab === 'accounts'} onPress={() => setTab('accounts')} />
          <Chip label="Flagged" active={tab === 'flagged'} onPress={() => setTab('flagged')} />
        </View>

        {tab === 'reports' && (
          <>
            {pending.length === 0 && <Empty icon="checkmark-done-outline" text="No reports waiting for review." />}
            {pending.map((r) => {
              const who = accountById(r.accountId);
              const frozen = who?.status === 'frozen';
              return (
                <Card key={r.id} style={r.emergency ? { borderWidth: 2, borderColor: C.danger } : undefined}>
                  {r.emergency && (
                    <View style={[s.rowCenter, { gap: 6, marginBottom: 6 }]}>
                      <Icon name="warning" size={16} color={C.danger} />
                      <Text style={{ color: C.danger, fontWeight: '800' }}>EMERGENCY FREEZE</Text>
                    </View>
                  )}
                  <Text style={{ color: C.ink, fontWeight: '700' }}>
                    {who?.name} (@{who?.username})
                  </Text>
                  <Muted>
                    Ticket {r.id.toUpperCase()} · {formatDate(r.timestamp)} · review by {formatDate(r.timestamp + 24 * 3_600_000)}
                  </Muted>
                  <Text style={{ color: C.ink, marginVertical: 10, lineHeight: 20 }}>{r.description}</Text>
                  {frozen ? (
                    <>
                      <Btn label="Confirm fraud — keep frozen" variant="danger" onPress={() => reviewReport(r.id, 'freeze')} />
                      <Btn
                        label="False alarm — unlock & close"
                        variant="ghost"
                        onPress={() => {
                          setAccountStatus(r.accountId, 'active');
                          reviewReport(r.id, 'dismiss');
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Btn label="Confirmed fraudulent — freeze account" variant="danger" onPress={() => confirmFreeze(r.id, who?.name ?? 'This user')} />
                      <Btn label="Dismiss report" variant="ghost" onPress={() => reviewReport(r.id, 'dismiss')} />
                    </>
                  )}
                </Card>
              );
            })}
            {closed.length > 0 && (
              <>
                <SectionTitle>Closed</SectionTitle>
                {closed.map((r) => (
                  <Muted key={r.id}>
                    {formatDate(r.timestamp)} · {accountById(r.accountId)?.name} · {r.status === 'dismissed' ? 'Dismissed' : 'Frozen'}
                  </Muted>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'accounts' &&
          customers.map((a) => (
            <Card key={a.id}>
              <View style={[s.rowCenter, { gap: 12 }]}>
                <Avatar name={a.name} path={a.avatar} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontWeight: '700' }}>
                    {a.name} {a.verified ? '✓' : ''}
                  </Text>
                  <Muted>
                    @{a.username} · {peso(a.balance ?? 0)}
                  </Muted>
                </View>
                <Text style={{ color: a.status === 'frozen' ? C.danger : C.success, fontWeight: '700' }}>{a.status === 'frozen' ? 'Frozen' : 'Active'}</Text>
              </View>
              <View style={{ marginTop: 10 }}>
                <Btn
                  label={a.status === 'frozen' ? 'Unlock account' : 'Freeze account'}
                  variant={a.status === 'frozen' ? 'soft' : 'ghost'}
                  onPress={() => setAccountStatus(a.id, a.status === 'frozen' ? 'active' : 'frozen')}
                />
              </View>
            </Card>
          ))}

        {tab === 'flagged' &&
          (flagged.length === 0 ? (
            <Empty icon="shield-checkmark-outline" text="No flagged transactions." />
          ) : (
            flagged.map((t) => (
              <Card key={t.id}>
                <View style={[s.rowCenter, { justifyContent: 'space-between' }]}>
                  <Text style={{ color: C.ink, fontWeight: '700', flex: 1 }}>
                    {accountById(t.accountId)?.name} → {t.counterparty}
                  </Text>
                  <Text style={{ color: RISK_COPY[t.risk].color, fontWeight: '700' }}>{RISK_COPY[t.risk].label}</Text>
                </View>
                <Muted>
                  {t.type} · {peso(t.amount)} · {t.status} · {formatDate(t.timestamp)}
                </Muted>
              </Card>
            ))
          ))}
      </View>
    </Screen>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <View style={[s.card, { flex: 1, marginBottom: 0, padding: 14, backgroundColor: alert ? C.dangerBg : C.card }]}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: alert ? C.danger : C.ink }}>{value}</Text>
      <Text style={{ color: C.mute, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
