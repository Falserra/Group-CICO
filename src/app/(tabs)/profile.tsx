// My profile: photo, personal details, and password / MPIN changes.
// Everything is stored in the CiCo database through the API (accounts and profiles tables).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { Avatar, Btn, C, Card, H1, H2, Input, Muted, Screen, SectionTitle, VerifiedBadge, formatDate, peso, s } from '@/components/wallet-ui';
import { useMe, useWallet } from '@/lib/wallet-store';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ProfileScreen() {
  const me = useMe();
  const { updateProfile, setAvatar, changePassword, changeMpin, logout } = useWallet();

  // What is saved right now; `dirty` lights up the Save button once the form differs from it.
  const saved = { name: me.name, email: me.profile.email ?? '', phone: me.profile.phone ?? '', birthdate: me.profile.birthdate ?? '', address: me.profile.address ?? '' };
  const [f, setF] = useState(saved);
  const set = (k: keyof typeof saved) => (v: string) => setF({ ...f, [k]: v });
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => f[k].trim() !== saved[k]);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const save = async () => {
    const v = { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), birthdate: f.birthdate.trim(), address: f.address.trim() };
    if (!v.name) return Alert.alert('Name needed', 'Your name cannot be empty.');
    if (v.email && !EMAIL.test(v.email)) return Alert.alert('Check your email', 'That email address does not look right.');
    if (v.phone && !/^[0-9+\-\s()]{7,20}$/.test(v.phone)) return Alert.alert('Check your number', 'Use 7–20 digits for your mobile number.');
    if (v.birthdate && (!DATE.test(v.birthdate) || Number.isNaN(Date.parse(v.birthdate)))) return Alert.alert('Check your birthdate', 'Write it as YYYY-MM-DD, for example 2003-05-14.');
    setSaving(true);
    const res = await updateProfile(v);
    setSaving(false);
    if (res.ok) {
      setF(v);
      Alert.alert('Profile saved', 'Your details were updated.');
    } else Alert.alert('Could not save', res.error);
  };

  // ---- Photo: pick or take, shrink to 512 px on the phone, upload ----
  const upload = async (picked: ImagePicker.ImagePickerResult) => {
    if (picked.canceled) return;
    setPhotoBusy(true);
    try {
      const context = ImageManipulator.manipulate(picked.assets[0].uri);
      context.resize({ width: 512 });
      const image = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!image.base64) throw new Error('empty');
      const res = await setAvatar(image.base64);
      if (!res.ok) Alert.alert('Could not update photo', res.error);
    } catch {
      Alert.alert('Could not use that photo', 'Try a different picture.');
    } finally {
      setPhotoBusy(false);
    }
  };
  const choosePhoto = async () => upload(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 }));
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera blocked', 'Allow camera access in your phone settings to take a photo.');
    upload(await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 }));
  };
  const removePhoto = () =>
    Alert.alert('Remove photo?', 'Your initials will be shown instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          const res = await setAvatar(null);
          setPhotoBusy(false);
          if (!res.ok) Alert.alert('Could not remove photo', res.error);
        },
      },
    ]);

  return (
    <Screen bare>
      <H1>Profile</H1>
      <Card style={{ alignItems: 'center' }}>
        <Avatar name={me.name} path={me.profile.avatar} size={96} />
        <Text style={{ color: C.ink, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{me.name}</Text>
        <Muted>@{me.username}</Muted>
        <View style={{ marginTop: 6 }}>
          <VerifiedBadge verified={me.verified} />
        </View>
        <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
          <Btn label="Choose photo" variant="soft" icon="image-outline" onPress={choosePhoto} loading={photoBusy} />
          {Platform.OS !== 'web' && <Btn label="Take photo" variant="ghost" icon="camera-outline" onPress={takePhoto} disabled={photoBusy} />}
          {me.profile.avatar && <Btn label="Remove photo" variant="ghost" onPress={removePhoto} disabled={photoBusy} />}
        </View>
      </Card>

      <SectionTitle>Personal details</SectionTitle>
      <Card>
        <Input label="Full name" value={f.name} onChangeText={set('name')} autoCapitalize="words" />
        <Input label="Email" placeholder="you@example.com" value={f.email} onChangeText={set('email')} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
        <Input label="Mobile number" placeholder="0917 123 4567" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Input label="Birthdate" placeholder="YYYY-MM-DD" value={f.birthdate} onChangeText={set('birthdate')} keyboardType="numbers-and-punctuation" maxLength={10} />
        <Input label="Address" placeholder="Barangay, city" value={f.address} onChangeText={set('address')} multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
        <Btn label="Save changes" onPress={save} loading={saving} disabled={!dirty} />
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        <Fact label="Wallet balance" value={peso(me.balance)} />
        <Fact label="Account status" value={me.status === 'frozen' ? 'Frozen' : 'Active'} danger={me.status === 'frozen'} />
        <Fact label="Account type" value={me.kind === 'merchant' ? 'Merchant' : 'Personal'} />
        <Fact label="Member since" value={formatDate(me.createdAt)} last />
      </Card>

      <SectionTitle>Sign-in security</SectionTitle>
      <ChangeSecret
        title="Change password"
        fields={[
          { key: 'current', label: 'Current password', secure: true },
          { key: 'next', label: 'New password', placeholder: '6+ characters', secure: true },
          { key: 'confirm', label: 'Confirm new password', secure: true },
        ]}
        validate={(v) => (v.next.length < 6 ? 'Use at least 6 characters.' : v.next !== v.confirm ? 'The new passwords do not match.' : null)}
        submit={(v) => changePassword(v.current, v.next)}
        done="Your password was changed. Other devices were signed out."
      />
      <ChangeSecret
        title="Change MPIN"
        fields={[
          { key: 'current', label: 'Current MPIN', secure: true, pin: true },
          { key: 'next', label: 'New MPIN', placeholder: '6 digits', secure: true, pin: true },
          { key: 'confirm', label: 'Confirm new MPIN', secure: true, pin: true },
        ]}
        validate={(v) => (!/^\d{6}$/.test(v.next) ? 'Your MPIN must be exactly 6 digits.' : v.next !== v.confirm ? 'The new MPINs do not match.' : null)}
        submit={(v) => changeMpin(v.current, v.next)}
        done="Your MPIN was changed."
      />
      <Btn label="Security center" variant="soft" icon="shield-checkmark-outline" onPress={() => router.push('/security')} />
      <Btn label="Log out" variant="ghost" icon="log-out-outline" onPress={logout} />
    </Screen>
  );
}

function Fact({ label, value, danger, last }: { label: string; value: string; danger?: boolean; last?: boolean }) {
  return (
    <View style={[s.rowCenter, { justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line }]}>
      <Text style={{ color: C.mute }}>{label}</Text>
      <Text style={{ color: danger ? C.danger : C.ink, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

type Field = { key: 'current' | 'next' | 'confirm'; label: string; placeholder?: string; secure?: boolean; pin?: boolean };

/** A collapsed card that opens into a small current / new / confirm form. */
function ChangeSecret({
  title,
  fields,
  validate,
  submit,
  done,
}: {
  title: string;
  fields: Field[];
  validate: (v: Record<Field['key'], string>) => string | null;
  submit: (v: Record<Field['key'], string>) => Promise<{ ok: true } | { ok: false; error: string }>;
  done: string;
}) {
  const empty = { current: '', next: '', confirm: '' };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(empty);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setV(empty);
  };
  const go = async () => {
    const problem = validate(v);
    if (problem) return Alert.alert(title, problem);
    setBusy(true);
    const res = await submit(v);
    setBusy(false);
    if (res.ok) {
      close();
      Alert.alert(title, done);
    } else Alert.alert(title, res.error);
  };

  if (!open) return <Btn label={title} variant="ghost" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <H2>{title}</H2>
      {fields.map((fl) => (
        <Input
          key={fl.key}
          label={fl.label}
          placeholder={fl.placeholder}
          secureTextEntry={fl.secure}
          keyboardType={fl.pin ? 'number-pad' : 'default'}
          maxLength={fl.pin ? 6 : 72}
          autoCapitalize="none"
          value={v[fl.key]}
          onChangeText={(t) => setV({ ...v, [fl.key]: t })}
        />
      ))}
      <Btn label="Update" onPress={go} loading={busy} />
      <Btn label="Cancel" variant="ghost" onPress={close} disabled={busy} />
    </Card>
  );
}
