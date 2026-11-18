// Shared UI kit for CiCo. Visual language: a retail-banking look (deep blue + gold, white cards on a
// pale canvas, generous spacing, line icons) so every screen reads as one product.
import Ionicons, { type IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fileUrl } from '@/lib/api';
import type { RiskLevel } from '@/lib/types';
import { RISK_COPY } from '@/lib/verification';

export const C = {
  primary: '#0A4DA2', // brand blue
  primaryDark: '#06336F',
  primarySoft: '#E7EFFB',
  accent: '#F2B01E', // gold
  ink: '#0F2144', // headings and body
  mute: '#64748B',
  bg: '#F2F5FA',
  card: '#FFFFFF',
  line: '#E2E8F0',
  success: '#0E9F6E',
  successBg: '#E3F7EF',
  warn: '#A15C07',
  warnBg: '#FFF4D6',
  danger: '#D92D20',
  dangerBg: '#FDEBEA',
  // Legacy names still used by a few screens.
  teal: '#0A4DA2',
};

export type IconName = IoniconsIconName;

export function Icon({ name, size = 22, color = C.ink }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const peso = (n: number) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (ts: number) => new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "Today", "Yesterday" or "12 Nov 2026" - used to group the activity list. */
export function dayLabel(ts: number) {
  const d = new Date(ts);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Scrollable page. `bare`: no navigation header, so clear the status bar. `flush`: full-bleed (the page lays out its own padding, e.g. under a Hero). */
export function Screen({ children, bare, flush }: { children: ReactNode; bare?: boolean; flush?: boolean }) {
  const insets = useSafeAreaInsets();
  const top = flush ? 0 : bare ? Math.max(insets.top, StatusBar.currentHeight ?? 0) + 12 : 16;
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{ paddingTop: top, paddingHorizontal: flush ? 0 : 20, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

/** Blue banner that sits behind the first card (home, login). Children render inside it. */
export function Hero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={[C.primaryDark, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: Math.max(insets.top, StatusBar.currentHeight ?? 0) + 14 }, style]}>
      <StatusBar barStyle="light-content" />
      {children}
    </LinearGradient>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Input(p: TextInputProps & { label?: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const { label, icon, style, secureTextEntry, onFocus, onBlur, ...rest } = p;
  const multiline = !!rest.multiline;
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={[s.inputWrap, focused && { borderColor: C.primary, backgroundColor: '#fff' }, multiline && { alignItems: 'flex-start' }]}>
        {icon && (
          <View style={{ marginRight: 10, marginTop: multiline ? 14 : 0 }}>
            <Icon name={icon} size={20} color={focused ? C.primary : C.mute} />
          </View>
        )}
        <TextInput
          placeholderTextColor="#94A3B8"
          {...rest}
          secureTextEntry={secureTextEntry && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[s.input, style]}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show' : 'Hide'}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={C.mute} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

type Variant = 'primary' | 'ghost' | 'danger' | 'soft' | 'teal' | 'gold';
type BtnProps = { label: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; icon?: IconName };
export function Btn({ label, onPress, variant = 'primary', disabled, loading, icon }: BtnProps) {
  const kind = variant === 'teal' ? 'soft' : variant;
  const look = {
    primary: { bg: C.primary, fg: '#fff', border: C.primary },
    gold: { bg: C.accent, fg: C.primaryDark, border: C.accent },
    danger: { bg: C.danger, fg: '#fff', border: C.danger },
    soft: { bg: C.primarySoft, fg: C.primary, border: C.primarySoft },
    ghost: { bg: 'transparent', fg: C.primary, border: C.primary },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={s.rowCenter}>
          {icon && (
            <View style={{ marginRight: 8 }}>
              <Icon name={icon} size={19} color={look.fg} />
            </View>
          )}
          <Text style={[s.btnT, { color: look.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}
export function H2({ children }: { children: ReactNode }) {
  return <Text style={s.h2}>{children}</Text>;
}
export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

/** Small uppercase section heading with an optional action link on the right. */
export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={[s.rowCenter, { justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }]}>
      <Text style={s.section}>{children}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Round icon badge used by list rows and quick actions. */
export function IconBubble({ name, color = C.primary, bg = C.primarySoft, size = 44 }: { name: IconName; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={color} />
    </View>
  );
}

/** Big tappable tile with an icon above a label (home quick actions). */
export function QuickAction({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.quick, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <IconBubble name={icon} size={46} />
      <Text style={s.quickT} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Inline colour-coded risk indicator (NFR-03): shown on the confirmation screen, no extra taps. */
export function RiskIndicator({ level, reasons }: { level: RiskLevel; reasons: string[] }) {
  const c = RISK_COPY[level];
  const icon: IconName = level === 'green' ? 'shield-checkmark' : level === 'yellow' ? 'alert-circle' : 'warning';
  return (
    <View style={[s.risk, { backgroundColor: c.bg, borderColor: c.color }]}>
      <View style={s.rowCenter}>
        <Icon name={icon} size={20} color={c.color} />
        <Text style={[s.riskT, { color: c.color }]}>{c.label}</Text>
      </View>
      {reasons.length === 0 ? (
        <Text style={[s.riskR, { color: c.color }]}>No warning signs found.</Text>
      ) : (
        reasons.map((r) => (
          <Text key={r} style={[s.riskR, { color: c.color }]}>
            • {r}
          </Text>
        ))
      )}
    </View>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <View style={[s.badge, { backgroundColor: verified ? C.successBg : C.warnBg }]}>
      <Icon name={verified ? 'checkmark-circle' : 'alert-circle'} size={13} color={verified ? C.success : C.warn} />
      <Text style={{ color: verified ? C.success : C.warn, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>{verified ? 'Verified' : 'Unverified'}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: C.primary, borderColor: C.primary }]}>
      <Text style={{ color: active ? '#fff' : C.ink, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

type RowProps = { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; tone?: 'danger'; icon?: IconName; iconColor?: string; iconBg?: string; chevron?: boolean };
export function ListRow({ title, subtitle, right, onPress, tone, icon, iconColor, iconBg, chevron }: RowProps) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      {icon && <IconBubble name={icon} color={iconColor ?? (tone === 'danger' ? C.danger : C.primary)} bg={iconBg ?? (tone === 'danger' ? C.dangerBg : C.primarySoft)} />}
      <View style={{ flex: 1 }}>
        <Text style={[s.rowT, tone === 'danger' && { color: C.danger }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={s.rowS}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron && <Icon name="chevron-forward" size={18} color="#94A3B8" />}
    </Pressable>
  );
}

/** A settings-style row with a switch. */
export function ToggleRow({ icon, title, subtitle, value, onChange }: { icon: IconName; title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <IconBubble name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowT}>{title}</Text>
        {subtitle ? <Text style={s.rowS}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.primary, false: '#CBD5E1' }} thumbColor="#fff" />
    </View>
  );
}

/** Profile photo, or the person's initials when they haven't added one. */
export function Avatar({ name, path, size = 56, ring }: { name: string; path?: string; size?: number; ring?: boolean }) {
  const uri = fileUrl(path);
  const round = { width: size, height: size, borderRadius: size / 2 };
  const border = ring ? { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' } : null;
  if (uri) return <Image source={{ uri }} style={[round, border, { backgroundColor: C.line }]} contentFit="cover" accessibilityLabel={`${name}'s photo`} />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View style={[round, border, { backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel={`${name}'s initials`}>
      <Text style={{ color: C.primaryDark, fontWeight: '800', fontSize: size * 0.38 }}>{initials || '?'}</Text>
    </View>
  );
}

export function Empty({ text, icon = 'file-tray-outline' }: { text: string; icon?: IconName }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
      <IconBubble name={icon} color={C.mute} bg={C.bg} size={52} />
      <Text style={[s.muted, { marginTop: 12, textAlign: 'center' }]}>{text}</Text>
    </Card>
  );
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hero: { paddingHorizontal: 20, paddingBottom: 64, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  h1: { fontSize: 26, fontWeight: '800', color: C.ink, marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '800', color: C.mute, letterSpacing: 0.8, textTransform: 'uppercase' },
  muted: { color: C.mute, fontSize: 14, lineHeight: 20 },
  label: { color: C.mute, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0F2144',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 13, color: C.ink, fontSize: 16 },
  btn: { borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 4, marginBottom: 8, minHeight: 52, justifyContent: 'center' },
  btnT: { fontWeight: '700', fontSize: 16 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  risk: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 14 },
  riskT: { fontWeight: '800', fontSize: 15, marginLeft: 8 },
  riskR: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  chip: { borderWidth: 1.5, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8, backgroundColor: C.card },
  row: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0F2144',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowT: { color: C.ink, fontSize: 15, fontWeight: '600' },
  rowS: { color: C.mute, fontSize: 13, marginTop: 2 },
  quick: { flex: 1, backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 8, shadowColor: '#0F2144', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  quickT: { color: C.ink, fontWeight: '600', fontSize: 12.5 },
});
