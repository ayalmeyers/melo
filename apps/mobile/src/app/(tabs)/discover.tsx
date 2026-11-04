import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ARTISTS, GENRES, SHOWS, artistName, flag, type Artist, type CatalogItem, type Profile } from '@melo/core';
import { api, configured } from '../../lib/supabase';
import { go, loadArtists, loadGenreArt, rememberArtist, rememberItem, useLoad } from '../../lib/hooks';
import { AppleSection, useAppleSearch } from '../../components/apple';
import { Screen } from '../../components/screen';
import { SectionTitle } from '../../components/post';
import { ItemRow } from '../../components/rows';
import { ArtistCover, Avatar, Band, Empty, GenreCover, Icon, Input, ItemCover, Sheet, Stars, T } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function Discover() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ items: CatalogItem[]; people: Profile[]; artists: Artist[] } | null>(null);
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes(null); return; }
    const t = setTimeout(() => {
      Promise.all([api.searchItems(s), api.searchPeople(s), api.searchArtists(s)])
        .then(([items, people, artists]) => { items.forEach(rememberItem); artists.forEach(rememberArtist); setRes({ items, people, artists }); })
        .catch(() => setRes({ items: [], people: [], artists: [] }));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const fromApple = useAppleSearch(q, ['album', 'show'], 10);
  const have = new Set(res?.items.map(i => i.id) ?? []);

  const top = useLoad(async () => {
    if (!configured) return null;
    const [rated, radar] = await Promise.all([api.mostRated(12).catch(() => []), api.radar(7).catch(() => [])]);
    const items = await api.items([...rated.map(r => r.item_id), ...radar.filter(r => r.subject_type === 'item').map(r => r.subject_id)]);
    items.forEach(rememberItem);
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    return { rated: rated.map(r => ({ r, it: byId[r.item_id] })).filter(x => x.it), radar, byId };
  }, []);
  const genreArt = useLoad(() => Promise.all([loadGenreArt(), loadArtists(Object.keys(ARTISTS))]), []);
  const fresh = useLoad(() => configured ? api.itemsBy({ type: 'album' }, 20) : Promise.resolve([]), []);

  return <Screen onRefresh={() => Promise.all([top.reload(), fresh.reload()])} keyboard>
    <Band>
      <T.Display>Discover</T.Display>
      <View>
        <Input dark value={q} onChangeText={setQ} placeholder="Albums, podcasts, artists, people" returnKeyType="search" clearButtonMode="while-editing" autoCorrect={false} style={{ paddingLeft: 40 }} />
        <View style={{ position: 'absolute', left: 13, top: 14 }}><Icon name="magnifyingglass" size={18} color={C.onInkDim} /></View>
      </View>
    </Band>
    <Sheet>
      {res ? <View style={{ gap: 14 }}>
        {res.artists.map(a =>
          <Pressable key={a.id} onPress={() => go(`/artist/${a.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><ArtistCover id={a.id} art={a.image_url ?? a.artwork_url} size={48} /><View><T.Bold>{a.name}</T.Bold><T.Dim>Artist {flag(a.cc)}</T.Dim></View></Pressable>)}
        {!!res.items.length && <SectionTitle title="On Melo" />}
        {res.items.map(it => <ItemRow key={it.id} it={it} />)}
        {res.people.map(p => <Pressable key={p.id} onPress={() => go(`/user/${p.handle}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={p.name} color={p.color} size={48} /><View><T.Bold>{p.name}</T.Bold><T.Dim>@{p.handle} {flag(p.cc)}</T.Dim></View></Pressable>)}
        <AppleSection title="Albums" results={fromApple?.filter(r => r.kind === 'album') ?? null} have={have} />
        <AppleSection title="Podcasts" results={fromApple?.filter(r => r.kind === 'show') ?? null} have={have} />
        {!res.items.length && !res.people.length && !res.artists.length && fromApple && !fromApple.length && <Empty text="Nothing found." />}
        <Pressable onPress={() => go(`/add-item?title=${encodeURIComponent(q.trim())}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Icon name="plus.circle.fill" size={22} color={C.blue} /><Text style={{ fontFamily: F.semibold, color: C.blue, fontSize: 15.5 }}>Still missing? Add it by hand</Text>
        </Pressable>
      </View> : <>
        <SectionTitle title="Genres" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} style={{ marginHorizontal: -20 }}>
          <View style={{ width: 8 }} />
          {Object.entries(GENRES).map(([id, g]) => <Pressable key={id} onPress={() => go(`/genre/${id}`)} style={{ width: 120, gap: 6 }}><GenreCover key={genreArt.loading ? 'g' : 'G'} id={id} size={120} radius={18} /><T.Bold>{g.name}</T.Bold></Pressable>)}
          <View style={{ width: 8 }} />
        </ScrollView>

        {!!top.data?.radar.length && <View style={{ gap: 12 }}>
          <SectionTitle title="Breakout Radar" />
          <T.Dim>Rising this week, weighted by listeners with the best forecasting records.</T.Dim>
          {top.data.radar.slice(0, 5).map((r, i) => {
            const label = r.subject_type === 'artist' ? artistName(r.subject_id) : top.data?.byId[r.subject_id]?.title ?? r.subject_id;
            return <Pressable key={r.subject_id} onPress={() => go(r.subject_type === 'artist' ? `/artist/${r.subject_id}` : `/item/${r.subject_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontFamily: F.heavy, fontSize: 20, color: C.blue, width: 22 }}>{i + 1}</Text>
              {r.subject_type === 'artist' ? <ArtistCover id={r.subject_id} size={44} /> : <ItemCover item={{ id: r.subject_id, title: label, type: 'album' }} size={44} radius={8} />}
              <View style={{ flex: 1 }}><T.Bold>{label}</T.Bold><T.Dim>{r.listeners} listeners · {r.score.toFixed(1)}× baseline</T.Dim></View>
            </Pressable>;
          })}
        </View>}

        <SectionTitle title="Artists" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} style={{ marginHorizontal: -20 }}>
          <View style={{ width: 6 }} />
          {Object.entries(ARTISTS).map(([id, a]) => <Pressable key={id} onPress={() => go(`/artist/${id}`)} style={{ width: 84, alignItems: 'center', gap: 6 }}><ArtistCover key={genreArt.loading ? 'a' : 'A'} id={id} size={76} /><Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text, textAlign: 'center' }} numberOfLines={2}>{a.name}</Text></Pressable>)}
          <View style={{ width: 6 }} />
        </ScrollView>

        {!!top.data?.rated.length && <View style={{ gap: 12 }}>
          <SectionTitle title="Most rated" />
          {top.data.rated.map(({ r, it }) => <ItemRow key={it.id} it={it} right={<View style={{ alignItems: 'flex-end' }}><Stars r10={Math.round(r.avg_stars * 2)} size={12} color={C.blue} /><T.Dim>{r.n}</T.Dim></View>} />)}
        </View>}

        <SectionTitle title="Podcasts" />
        {SHOWS.map(([id, title, host]) => <ItemRow key={id} it={{ id, title, artist_name: host, type: 'show', year: null, cc: 'US' } as CatalogItem} />)}

        {!!fresh.data?.length && <View style={{ gap: 12 }}><SectionTitle title="In the catalog" />{fresh.data.map(it => <ItemRow key={it.id} it={it} />)}</View>}
      </>}
    </Sheet>
  </Screen>;
}
