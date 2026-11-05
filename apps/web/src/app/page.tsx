import Link from 'next/link';
import { ALBUMS, CATALOG_ART, GENRES, seedItemArt } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { PostList, WaitlistForm } from '@/components/interactive';
import { Gauge, GenreArt, ItemArt } from '@/components/ui';

export default async function Home() {
  const api = await serverApi();
  const [hot, forecasts] = await Promise.all([safe(() => api.feed('hot', { limit: 6 }), []), safe(() => api.forecasts('open'), [])]);
  // A wall of real covers: this week's most-charted records first, then the hand-picked classics.
  const wall = [...CATALOG_ART.extraAlbums.slice(0, 5).map(e => ({ id: e.id, title: e.title })), ...ALBUMS.map(([id, title]) => ({ id: id as string, title: title as string })).filter(a => seedItemArt(a.id))].slice(0, 9);
  return <>
    <section className="band hero"><div className="wrap two" style={{ alignItems: 'center' }}>
      <div>
        <span className="eyebrow">For people with opinions about music</span>
        <h1 style={{ marginTop: 14 }}>Every album has a room. <em>Every episode</em> has a group chat.</h1>
        <p className="lede">Log what you hear, rate it, argue about it, forecast what happens next, and share it anywhere. Melo works alongside Spotify and Apple Music.</p>
        <WaitlistForm source="home" />
        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>iPhone app coming soon. The website is open now. <Link href="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Sign in</Link></p>
      </div>
      <div className="stack">
        {wall.length >= 9 && <div className="wall" aria-label="Records people are talking about">{wall.map(w => <Link key={w.id} href={`/album/${w.id}`}><ItemArt item={{ ...w, type: 'album' }} /></Link>)}</div>}
        {forecasts.slice(0, wall.length >= 9 ? 1 : 2).map(f => <Link key={f.id} href={`/forecasts/${f.id}`} className="fc" style={{ background: '#fff', color: 'var(--text)' }}><div className="row" style={{ flexWrap: 'nowrap' }}><Gauge p={f.c?.crowd_p ?? null} /><div style={{ minWidth: 0 }}><p className="q">{f.question}</p><p className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{f.c?.forecasters ?? 0} forecasters · the crowd&apos;s number</p></div></div></Link>)}
      </div>
    </div></section>
    <div className="sheet"><div className="wrap">
      <section className="sec"><div className="sec-h"><div><span className="eyebrow">How it works</span><h2 style={{ marginTop: 8 }}>Log it. Argue it. Call it.</h2></div></div>
        <div className="g3">
          <div className="step card"><b className="eyebrow" style={{ color: 'var(--blue)' }}>Log</b><h3>Rate anything in two taps</h3><p>Albums and podcast episodes, with half stars. Your diary and Passport fill in as you go.</p></div>
          <div className="step card"><b className="eyebrow" style={{ color: 'var(--blue)' }}>Argue</b><h3>Every artist and genre has a board</h3><p>Reviews, one-line takes people vote on, long threads, and a wiki anyone can improve.</p></div>
          <div className="step card"><b className="eyebrow" style={{ color: 'var(--blue)' }}>Call it</b><h3>Forecast what happens next</h3><p>Put a number on releases, charts and breakouts. The crowd answer weights people by how often they&apos;ve been right.</p></div>
        </div></section>
      <section className="sec" style={{ paddingTop: 0 }}><div className="sec-h"><h2>Hot right now</h2><Link className="btn sm ghost" href="/feed">Open the feed</Link></div><PostList posts={hot} empty="Nothing posted yet. Sign in and be first." /></section>
      <section className="sec" style={{ paddingTop: 0 }}><div className="sec-h"><h2>Genres</h2><Link href="/explore" style={{ color: 'var(--blue)', fontWeight: 600 }}>Explore everything</Link></div>
        <div className="g6">{Object.entries(GENRES).slice(0, 12).map(([id, g]) => <Link key={id} href={`/genre/${id}`} className="cover-tile"><GenreArt id={id} /><b>{g.name}</b></Link>)}</div></section>
    </div></div>
  </>;
}
