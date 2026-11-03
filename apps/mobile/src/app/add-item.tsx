import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ARTISTS, CNAME, FLAG, GENRES } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go } from '../lib/hooks';
import { Seg } from '../components/screen';
import { Button, Chip, Input, T } from '../components/ui';

export default function AddItem() {
  const p = useLocalSearchParams<{ title?: string; type?: 'album' | 'episode'; show?: string; artist?: string; genre?: string }>();
  const { user, toast } = useSession();
  const [type, setType] = useState<'album' | 'episode'>(p.type ?? 'album');
  const [title, setTitle] = useState(p.title ?? '');
  const [artist, setArtist] = useState(p.artist ? ARTISTS[p.artist]?.name ?? '' : '');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState(p.genre ?? (p.show ? 'podcasts' : 'pop'));
  const [cc, setCc] = useState('US');
  const [busy, setBusy] = useState(false);
  if (!user) return <View style={{ padding: 20, gap: 14 }}><T.Body>Sign in to add albums and episodes.</T.Body><Button title="Sign in" onPress={() => go('/login')} /></View>;

  const artistId = Object.entries(ARTISTS).find(([, a]) => a.name.toLowerCase() === artist.trim().toLowerCase())?.[0] ?? null;
  const y = year ? Number(year) : null;
  const valid = title.trim().length > 0 && artist.trim().length > 0 && (y === null || (y >= 1900 && y <= new Date().getFullYear() + 1));

  const save = async () => {
    setBusy(true);
    try {
      const id = await api.addItem({ type, title: title.trim(), artist_name: artist.trim(), artist_id: artistId, show_id: type === 'episode' ? p.show ?? null : null, year: y, cc, genre });
      toast('Added to Melo');
      router.back();
      setTimeout(() => go(`/item/${id}`), 250);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Seg dark={false} value={type} onChange={setType} options={[['album', 'Album'], ['episode', 'Podcast episode']]} />
      <Input value={title} onChangeText={setTitle} placeholder={type === 'album' ? 'Album title' : 'Episode title'} maxLength={200} />
      <Input value={artist} onChangeText={setArtist} placeholder={type === 'album' ? 'Artist' : 'Show or host'} maxLength={200} />
      <Input value={year} onChangeText={t => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="Year (optional)" keyboardType="number-pad" />
      <T.Label>Genre</T.Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(GENRES).map(([id, g]) => <Chip key={id} dark={false} label={g.name} on={genre === id} onPress={() => setGenre(id)} />)}</View>
      <T.Label>Country</T.Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.keys(FLAG).map(c => <Chip key={c} dark={false} label={`${FLAG[c]} ${CNAME[c]}`} on={cc === c} onPress={() => setCc(c)} />)}</View>
      <T.Dim>Added items are checked by moderators. Duplicates get merged.</T.Dim>
      <Button title="Add" disabled={!valid} loading={busy} onPress={save} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
