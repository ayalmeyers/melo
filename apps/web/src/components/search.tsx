'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GENRES, flag, type Artist, type CatalogItem, type Profile } from '@melo/core';
import { AppleSection, useAppleSearch } from './apple';
import { useMelo } from './session';
import { ArtistArt, Avatar, GenreArt, Icon, ItemArt } from './ui';
import { AddItemForm } from './interactive';
import { useRouter } from 'next/navigation';

export function SearchBox() {
  const { api, requireSignIn } = useMelo(); const router = useRouter();
  const [q, setQ] = useState(''); const [items, setItems] = useState<CatalogItem[]>([]); const [people, setPeople] = useState<Profile[]>([]); const [artists, setArtists] = useState<Artist[]>([]); const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setItems([]); setPeople([]); setArtists([]); return; }
      const [i, p, a] = await Promise.all([api.searchItems(q, 12).catch(() => []), api.searchPeople(q.replace(/[%,()]/g, '')).catch(() => []), api.searchArtists(q, 6).catch(() => [])]);
      setItems(i); setPeople(p); setArtists(a);
    }, 220);
    return () => clearTimeout(t);
  }, [api, q]);
  const ql = q.trim().toLowerCase();
  const fromApple = useAppleSearch(q, ['album', 'show'], 8);
  const have = new Set(items.map(i => i.id));
  const genres = ql ? Object.entries(GENRES).filter(([, g]) => g.name.toLowerCase().includes(ql)) : [];
  return <div className="stack">
    <label className="row" style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: 'var(--lift)', borderRadius: 999, padding: '0 18px', height: 54, color: 'var(--dim)', flexWrap: 'nowrap' }}><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Albums, artists, genres, people" aria-label="Search Melo" style={{ flex: 1, background: 'none', border: 0, outline: 0, color: '#fff', fontSize: 17 }} /></label>
    {ql && <div className="card stack" style={{ color: 'var(--text)' }}>
      {artists.map(a => <Link key={a.id} className="list-row" href={`/artist/${a.id}`}><ArtistArt id={a.id} name={a.name} art={a.image_url ?? a.artwork_url} size={48} /><span className="m"><b>{a.name}</b><small>Artist {flag(a.cc)}</small></span></Link>)}
      {items.map(it => <Link key={it.id} className="list-row" href={`/album/${it.id}`}><ItemArt item={it} size={48} /><span className="m"><b>{it.title}</b><small>{it.artist_name} · {it.type}</small></span></Link>)}
      {genres.map(([id, g]) => <Link key={id} className="list-row" href={`/genre/${id}`}><GenreArt id={id} size={48} /><span className="m"><b>#{g.name}</b><small>Genre</small></span></Link>)}
      {people.map(p => <Link key={p.id} className="list-row" href={`/u/${p.handle}`}><Avatar name={p.name} color={p.color} size="lg" /><span className="m"><b>{p.name}</b><small>@{p.handle}</small></span></Link>)}
      <AppleSection title="Albums" results={fromApple?.filter(r => r.kind === 'album') ?? null} have={have} />
      <AppleSection title="Podcasts" results={fromApple?.filter(r => r.kind === 'show') ?? null} have={have} />
      {!artists.length && !items.length && !genres.length && !people.length && fromApple && !fromApple.length && <p className="muted">Nothing matches “{q}”.</p>}
      {adding ? <AddItemForm initialTitle={q} onDone={id => { setAdding(false); if (id) router.push(`/album/${id}`); }} /> : <button className="btn ghost" onClick={() => { if (requireSignIn()) setAdding(true); }}><Icon name="plus" size={18} /> Still missing? Add “{q}” by hand</button>}
    </div>}
  </div>;
}
