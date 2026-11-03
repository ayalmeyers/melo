import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AVATAR_COLORS, HANDLE_RE, LIMITS } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { errText, fail, go, openWeb } from '../lib/hooks';
import { Avatar, Button, Input, T } from '../components/ui';
import { C, F } from '../components/theme';

export default function Settings() {
  const { user, profile, reload, toast } = useSession();
  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [color, setColor] = useState(profile?.color ?? AVATAR_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (profile) { setName(profile.name); setHandle(profile.handle); setBio(profile.bio); setCity(profile.city); setColor(profile.color); } }, [profile]);

  const save = async () => {
    if (!HANDLE_RE.test(handle)) return toast('Usernames are 3 to 20 letters, numbers or underscores.');
    setBusy(true);
    try { await api.saveProfile({ name: name.trim(), handle, bio: bio.trim(), city: city.trim(), color }); await reload(); toast('Saved'); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  // App Store guideline 5.1.1(v): people must be able to delete their account from inside the app.
  const del = () => Alert.alert('Delete your account?', 'Your profile, posts, comments, logs, forecasts and messages are permanently deleted. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: async () => { setDeleting(true); try { await api.deleteAccount(); await reload(); router.replace('/'); Alert.alert('Account deleted', 'Your Melo account and data are gone.'); } catch (e) { Alert.alert('Could not delete', errText(e)); } finally { setDeleting(false); } } },
  ]);

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
    <ScrollView style={{ backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {user && profile && <>
        <T.Label>Profile</T.Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={name || '?'} color={color} size={56} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 }}>{AVATAR_COLORS.map(c => <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Color ${c}`} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: C.ink }} />)}</View>
        </View>
        <Input value={name} onChangeText={setName} placeholder="Name" maxLength={50} />
        <Input value={handle} onChangeText={t => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} placeholder="username" autoCapitalize="none" autoCorrect={false} />
        <Input value={bio} onChangeText={setBio} placeholder="Bio" multiline maxLength={LIMITS.bio} style={{ minHeight: 70 }} />
        <Input value={city} onChangeText={setCity} placeholder="City (optional)" maxLength={60} />
        <Button title="Save" loading={busy} onPress={save} />
        <Button kind="ghost" title="Change Top 4 and genres" onPress={() => go('/onboarding')} />
      </>}

      <T.Label>Melo</T.Label>
      <Button kind="ghost" title="Support and contact" onPress={() => openWeb('/support')} />
      <Button kind="ghost" title="Community guidelines and Terms" onPress={() => openWeb('/terms')} />
      <Button kind="ghost" title="Privacy Policy" onPress={() => openWeb('/privacy')} />

      {user && <>
        <T.Label>Account</T.Label>
        <T.Dim>Signed in as {user.email}</T.Dim>
        <Button kind="ghost" title="Sign out" onPress={async () => { await api.signOut(); await reload(); router.replace('/'); }} />
        <View style={{ backgroundColor: '#fdecec', borderRadius: 18, padding: 16, gap: 10, marginTop: 10 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bad }}>Delete account</Text>
          <T.Dim>Type DELETE to confirm. This removes everything you've posted.</T.Dim>
          <Input value={confirm} onChangeText={setConfirm} placeholder="DELETE" autoCapitalize="characters" autoCorrect={false} />
          <Button kind="danger" title="Delete my account" disabled={confirm !== 'DELETE'} loading={deleting} onPress={del} />
        </View>
      </>}
      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.dim, textAlign: 'center', marginTop: 10 }}>Melo {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
