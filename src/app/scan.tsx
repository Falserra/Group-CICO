// Link / SMS checker (FR-02, revised): flags known-malicious domains and phishing
// patterns with a visible warning before the user opens anything.
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text } from 'react-native';

import { Alert } from '@/lib/alert';
import { Btn, C, Card, Input, Muted, RiskIndicator, Screen } from '@/components/wallet-ui';
import { scanMessage } from '@/lib/verification';

export default function ScanScreen() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<(ReturnType<typeof scanMessage> & { ms: number }) | null>(null);

  const scan = () => {
    if (!text.trim()) return Alert.alert('Nothing to check', 'Paste a link or the full text message.');
    // FR-02 (revised): scan within 1.5 s of receipt – the duration is shown.
    const t0 = performance.now();
    const r = scanMessage(text);
    setResult({ ...r, ms: performance.now() - t0 });
  };

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip) {
      setText(clip);
      setResult(null);
    }
  };

  const open = (url: string, level: string) => {
    const go = () => WebBrowser.openBrowserAsync(url.startsWith('http') ? url : `https://${url}`);
    if (level === 'green') return go();
    Alert.alert('This link looks unsafe', 'CiCo recommends not opening it. Open anyway?', [
      { text: 'Don’t open', style: 'cancel' },
      { text: 'Open anyway', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen>
      <Card>
        <Input
          label="Paste a link or text message"
          placeholder="e.g. You won ₱500,000! Claim at…"
          multiline
          value={text}
          onChangeText={(v) => {
            setText(v);
            setResult(null);
          }}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
          autoCapitalize="none"
        />
        <Btn label="Check it" icon="shield-checkmark-outline" onPress={scan} />
        <Btn label="Paste from clipboard" variant="soft" icon="clipboard-outline" onPress={paste} />
      </Card>

      {result && (
        <>
          <RiskIndicator level={result.level} reasons={result.reasons} />
          <Muted style={{ marginTop: -6, marginBottom: 10 }}>Checked in {result.ms < 1 ? '< 1' : result.ms.toFixed(0)} ms</Muted>
          {result.urls.map((u) => (
            <Card key={u.url}>
              <Text style={{ color: C.ink, fontWeight: '600' }} numberOfLines={1}>
                {u.url}
              </Text>
              <Btn label={u.result.level === 'green' ? 'Open link' : 'Open anyway…'} variant={u.result.level === 'green' ? 'primary' : 'ghost'} onPress={() => open(u.url, u.result.level)} />
            </Card>
          ))}
          {result.level !== 'green' && <Muted>Delete the message and don&apos;t reply. If you already tapped the link or shared a code, use Emergency freeze in the Security tab.</Muted>}
        </>
      )}
      <Muted style={{ marginTop: 8 }}>CiCo checks links against known scam sites and looks for tricks such as look-alike names, shortened links and urgent wording.</Muted>
    </Screen>
  );
}
