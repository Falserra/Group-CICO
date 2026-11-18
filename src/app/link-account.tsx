// Linked accounts: the banks and cards used to top up the wallet.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Btn, C, Card, Chip, Empty, H2, Input, ListRow, Muted, Screen, SectionTitle } from '@/components/wallet-ui';
import { useWallet } from '@/lib/wallet-store';

export default function LinkAccountScreen() {
  const { paymentMethods, linkAccount, unlinkAccount } = useWallet();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<'bank' | 'card'>('bank');
  const [label, setLabel] = useState('');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!label.trim()) return Alert.alert('Name needed', 'Give this account a name, for example "BPI Savings".');
    if (number.replace(/\D/g, '').length < 8) return Alert.alert('Check the number', 'Enter the full account or card number.');
    setBusy(true);
    const res = await linkAccount({ label: label.trim(), type, number });
    setBusy(false);
    if (!res.ok) return Alert.alert('Could not link account', res.error);
    setAdding(false);
    setLabel('');
    setNumber('');
  };

  const remove = (id: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'You can link it again later.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await unlinkAccount(id);
          if (!res.ok) Alert.alert('Could not remove account', res.error);
        },
      },
    ]);

  return (
    <Screen>
      <SectionTitle>Your accounts</SectionTitle>
      {paymentMethods.length === 0 && <Empty icon="card-outline" text="No accounts linked yet. Link a bank account or card to top up your wallet." />}
      {paymentMethods.map((p) => (
        <ListRow
          key={p.id}
          icon={p.accountType === 'card' ? 'card-outline' : 'business-outline'}
          title={p.label}
          subtitle={`${p.accountType === 'card' ? 'Card' : 'Bank account'} ${p.accountNumber}`}
          right={
            <Text onPress={() => remove(p.id, p.label)} style={{ color: C.danger, fontWeight: '700' }}>
              Remove
            </Text>
          }
        />
      ))}

      {adding ? (
        <Card>
          <H2>Link an account</H2>
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Chip label="Bank account" active={type === 'bank'} onPress={() => setType('bank')} />
            <Chip label="Card" active={type === 'card'} onPress={() => setType('card')} />
          </View>
          <Input icon="pricetag-outline" label="Name" placeholder={type === 'card' ? 'e.g. Visa Debit' : 'e.g. BPI Savings'} value={label} onChangeText={setLabel} />
          <Input icon={type === 'card' ? 'card-outline' : 'business-outline'} label={type === 'card' ? 'Card number' : 'Account number'} placeholder="Digits only" keyboardType="number-pad" maxLength={23} value={number} onChangeText={setNumber} />
          <Btn label="Link account" onPress={save} loading={busy} />
          <Btn label="Cancel" variant="ghost" onPress={() => setAdding(false)} disabled={busy} />
        </Card>
      ) : (
        <Btn label="Link a bank account or card" icon="add" onPress={() => setAdding(true)} disabled={paymentMethods.length >= 5} />
      )}

      <Muted style={{ marginTop: 6 }}>CiCo keeps only the last four digits of a number. Top-ups run in sandbox mode: no real bank or card is charged.</Muted>
    </Screen>
  );
}
