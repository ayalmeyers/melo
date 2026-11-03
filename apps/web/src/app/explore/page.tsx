import type { Metadata } from 'next';
import Link from 'next/link';
import { ARTISTS, GENRES, artistName, flag, countryName } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { SearchBox } from '@/components/search';
import { ArtistArt, GenreArt, ItemArt } from '@/components/ui';

export const metadata: Metadata = { title: 'Explore' };

export default async function Explore() {
  const api = await serverApi();
  const [radar, top] = await Promise.all([safe(() => api.radar(7), []), safe(() => api.mostRated(12), [])]);
  const radarItems = await safe(() => api.items(radar.filter(r => r.subject_type === 'item').map(r => r.subject_id)), []);
  const topItems = await safe(() => api.items(top.map(t => t.item_id)), []);
  const byId = Object.fromEntries([...radarItems, ...topItems].map(i => [i.id, i]));
  return <>
    <section className="band"><div className="wrap" style={{ paddingTop: 40, paddingBottom: 72 }}><span className="eyebrow">Explore</span><h1 style={{ fontSize: 'clamp(32px,5vw,48px)', margin: '8px 0 20px' }}>Find your next argument</h1><SearchBox /></div></section>
    <div className="sheet"><div className="wrap sec two">
      <div className="stack" style={{ gap: 36 }}>
        <section><div className="sec-h"><h2>Most rated on Melo</h2></div>
          {topItems.length ? <div className="g6">{top.map(t => byId[t.item_id] && <Link key={t.item_id} className="cover-tile" href={`/album/${t.item_id}`}><ItemArt item={byId[t.item_id]} /><b>{byId[t.item_id].title}</b><small>{t.avg_stars}★ · {t.n} rating{t.n === 1 ? '' : 's'}</small></Link>)}</div> : <p className="muted">Ratings show up here as people log what they hear.</p>}</section>
        <section><div className="sec-h"><h2>Genres</h2></div><div className="g6">{Object.entries(GENRES).map(([id, g]) => <Link key={id} href={`/genre/${id}`} className="cover-tile"><GenreArt id={id} /><b>{g.name}</b></Link>)}</div></section>
        <section><div className="sec-h"><h2>Artists</h2></div><div className="g6">{Object.entries(ARTISTS).map(([id, a]) => <Link key={id} href={`/artist/${id}`} className="cover-tile"><ArtistArt id={id} name={a.name} /><b>{a.name}</b><small>{flag(a.cc)} {countryName(a.cc)}</small></Link>)}</div></section>
      </div>
      <aside className="side"><div className="card"><h3>Breakout Radar</h3><p className="muted" style={{ fontSize: 14, margin: '4px 0 8px' }}>Listening that is rising fastest this week, weighted toward people with strong Ear scores.</p>
        {radar.length ? radar.map(r => { const isArtist = r.subject_type === 'artist'; const it = byId[r.subject_id]; return <Link key={r.subject_id} className="list-row" href={isArtist ? `/artist/${r.subject_id}` : `/album/${r.subject_id}`}>{isArtist ? <ArtistArt id={r.subject_id} size={44} /> : it ? <ItemArt item={it} size={44} /> : null}<span className="m"><b>{isArtist ? artistName(r.subject_id) : it?.title ?? r.subject_id}</b><small>{r.listeners} listener{r.listeners === 1 ? '' : 's'} this week</small></span><span className="up">{r.baseline > 0 ? `+${Math.round(((r.recent - r.baseline) / r.baseline) * 100)}%` : 'New'}</span></Link>; }) : <p className="muted" style={{ fontSize: 14 }}>Fills in as people log listens.</p>}</div></aside>
    </div></div>
  </>;
}
