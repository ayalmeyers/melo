import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { appleMeloId, type AppleKind, type AppleResult } from '@melo/core';
import { api } from '../lib/supabase';
import { apple } from '../lib/apple';
import { useSession } from '../lib/session';
import { fail, go, rememberItem } from '../lib/hooks';
import { Icon, T } from './ui';
import { Image } from 'expo-image';
import { C, F } from './theme';

/** Searches Apple's catalog as you type, a quarter second after the last keystroke. */
export function useAppleSearch(q: string, kinds: AppleKind[], limit = 12) {
  const [res, setRes] = useState<AppleResult[] | null>(null);
  const key = kinds.join();
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const lists = await Promise.all(kinds.map(k => apple.search(s, k, limit)));
      if (alive) setRes(lists.flat());
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, key, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  return res;
}

/** Imports a result into Melo (or finds it) and returns the Melo id. */
export async function importApple(r: AppleResult) {
  const id = await api.importApple(r);
  const it = await api.item(id).catch(() => null);
  if (it) rememberItem(it);
  return id;
}

const year = (d?: string) => (d ? d.slice(0, 4) : '');
const sub = (r: AppleResult) => r.kind === 'album' ? [r.artist, year(r.release_date)].filter(Boolean).join(' · ')
  : r.kind === 'show' ? [r.artist, 'Podcast'].filter(Boolean).join(' · ')
  : [r.show_title, r.dur_min ? `${r.dur_min} min` : '', year(r.release_date)].filter(Boolean).join(' · ');

/** One Apple result. Tapping adds it to Melo and opens its page, or hands its id to onPick. */
export function AppleRow({ r, onPick, existing }: { r: AppleResult; onPick?: (id: string) => void; existing?: boolean }) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (existing) { onPick ? onPick(appleMeloId(r)) : go(`/item/${appleMeloId(r)}`); return; }
    if (!user) return go('/login');
    setBusy(true);
    try { const id = await importApple(r); onPick ? onPick(id) : go(`/item/${id}`); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return <Pressable onPress={open} disabled={busy} accessibilityLabel={`${r.title}, ${sub(r)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    {r.artwork ? <Image source={{ uri: r.artwork }} style={{ width: 56, height: 56, borderRadius: r.kind === 'show' ? 14 : 10, backgroundColor: C.mist }} contentFit="cover" transition={150} />
      : <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: C.card2 }} />}
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }} numberOfLines={1}>{r.title}</Text>
      <T.Dim numberOfLines={1}>{sub(r)}</T.Dim>
    </View>
    {busy ? <ActivityIndicator color={C.blue} /> : <Icon name={existing ? 'chevron.right' : 'plus.circle'} size={20} color={existing ? C.dim : C.blue} />}
  </Pressable>;
}

/** A labelled block of Apple results, with the attribution Apple's terms ask for. */
export function AppleSection({ title, results, onPick, have }: { title: string; results: AppleResult[] | null; onPick?: (id: string) => void; have?: Set<string> }) {
  if (!results) return null;
  if (!results.length) return null;
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T.H2>{title}</T.H2>
      <T.Dim>from Apple</T.Dim>
    </View>
    {results.map(r => <AppleRow key={r.kind + r.apple_id} r={r} onPick={onPick} existing={have?.has(appleMeloId(r))} />)}
  </View>;
}
