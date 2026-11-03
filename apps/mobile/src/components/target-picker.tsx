import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ARTISTS, GENRES, type CatalogItem, type Target } from '@melo/core';
import { api } from '../lib/supabase';
import { rememberItem, targetLabel } from '../lib/hooks';
import { ArtistCover, GenreCover, Icon, Input, ItemCover, T } from './ui';
import { C, F } from './theme';

/** Search albums, episodes, artists and genres to attach a post or forecast to. */
export function TargetPicker({ value, onChange, itemsOnly }: { value: Target | null; onChange: (t: Target | null) => void; itemsOnly?: boolean }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    const s = q.trim(); if (s.length < 2) { setItems([]); return; }
    const t = setTimeout(() => api.searchItems(s, 8).then(r => { r.forEach(rememberItem); setItems(r); }).catch(() => {}), 220);
    return () => clearTimeout(t);
  }, [q]);

  if (value) return <Pressable onPress={() => onChange(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.mist, borderRadius: 14, padding: 10 }}>
    {value.type === 'item' ? <ItemCover item={{ id: value.id, title: targetLabel(value), type: 'album' }} size={40} radius={8} /> : value.type === 'artist' ? <ArtistCover id={value.id} size={40} /> : <GenreCover id={value.id} size={40} radius={8} />}
    <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 16, color: C.text }} numberOfLines={1}>{targetLabel(value)}</Text>
    <Icon name="xmark.circle.fill" size={20} color={C.dim} />
  </Pressable>;

  const s = q.trim().toLowerCase();
  const artists = itemsOnly || s.length < 2 ? [] : Object.entries(ARTISTS).filter(([, a]) => a.name.toLowerCase().includes(s)).slice(0, 4);
  const genres = itemsOnly || s.length < 2 ? [] : Object.entries(GENRES).filter(([, g]) => g.name.toLowerCase().includes(s)).slice(0, 3);
  const row = (key: string, art: React.ReactNode, title: string, sub: string, t: Target) => <Pressable key={key} onPress={() => { onChange(t); setQ(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>{art}<View style={{ flex: 1 }}><T.Bold>{title}</T.Bold><T.Dim>{sub}</T.Dim></View></Pressable>;
  return <View style={{ gap: 8 }}>
    <Input value={q} onChangeText={setQ} placeholder={itemsOnly ? 'Search albums and episodes' : 'About an album, artist or genre? (optional)'} autoCorrect={false} />
    {artists.map(([id, a]) => row('a' + id, <ArtistCover id={id} size={40} />, a.name, 'Artist board', { type: 'artist', id }))}
    {genres.map(([id, g]) => row('g' + id, <GenreCover id={id} size={40} radius={8} />, g.name, 'Genre board', { type: 'genre', id }))}
    {items.map(it => row('i' + it.id, <ItemCover item={it} size={40} radius={8} />, it.title, `${it.artist_name}${it.year ? ' · ' + it.year : ''}`, { type: 'item', id: it.id }))}
  </View>;
}
