'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ARTISTS, GENRES, flag, type CatalogItem, type Profile } from '@melo/core';
import { useMelo } from './session';
import { ArtistArt, Avatar, GenreArt, Icon, ItemArt } from './ui';
import { AddItemForm } from './interactive';
import { useRouter } from 'next/navigation';

export function SearchBox() {
  const { api, requireSignIn } = useMelo(); const router = useRouter();
  const [q, setQ] = useState(''); const [items, setItems] = useState<CatalogItem[]>([]); const [people, setPeople] = useState<Profile[]>([]); const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setItems([]); setPeople([]); return; }
      const [i, p] = await Promise.all([api.searchItems(q, 12).catch(() => []), api.searchPeople(q.replace(/[%,()]/g, '')).catch(() => [])]);
      setItems(i); setPeople(p);
    }, 220);
    return () => clearTimeout(t);
  }, [api, q]);
  const ql = q.trim().toLowerCase();
  const artists = ql ? Object.entries(ARTISTS).filter(([, a]) => a.name.toLowerCase().includes(ql)) : [];
  const genres = ql ? Object.entries(GENRES).filter(([, g]) => g.name.toLowerCase().includes(ql)) : [];
  return <div className="stack">
    <label className="row" style={{ background: 'var(--ink-2)', borderRadius: 16, padding: '0 16px', height: 54, color: 'var(--on-ink-dim)', flexWrap: 'nowrap' }}><Icon name="search" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Albums, artists, genres, people" aria-label="Search Melo" style={{ flex: 1, background: 'none', border: 0, outline: 0, color: '#fff', fontSize: 17 }} /></label>
    {ql && <div className="card stack" style={{ color: 'var(--text)' }}>
      {artists.map(([id, a]) => <Link key={id} className="list-row" href={`/artist/${id}`}><ArtistArt id={id} size={48} /><span className="m"><b>{a.name}</b><small>Artist · {flag(a.cc)}</small></span></Link>)}
      {items.map(it => <Link key={it.id} className="list-row" href={`/album/${it.id}`}><ItemArt item={it} size={48} /><span className="m"><b>{it.title}</b><small>{it.artist_name} · {it.type}</small></span></Link>)}
      {genres.map(([id, g]) => <Link key={id} className="list-row" href={`/genre/${id}`}><GenreArt id={id} size={48} /><span className="m"><b>#{g.name}</b><small>Genre</small></span></Link>)}
      {people.map(p => <Link key={p.id} className="list-row" href={`/u/${p.handle}`}><Avatar name={p.name} color={p.color} size="lg" /><span className="m"><b>{p.name}</b><small>@{p.handle}</small></span></Link>)}
      {!artists.length && !items.length && !genres.length && !people.length && <p className="muted">Nothing matches “{q}”.</p>}
      {adding ? <AddItemForm initialTitle={q} onDone={id => { setAdding(false); if (id) router.push(`/album/${id}`); }} /> : <button className="btn ghost" onClick={() => { if (requireSignIn()) setAdding(true); }}><Icon name="plus" size={18} /> Add “{q}” to Melo</button>}
    </div>}
  </div>;
}
