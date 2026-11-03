import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { countryName, flag, genreName } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { ComposeButton, ItemRow, LogButton, Moments, PostList, WikiBox } from '@/components/interactive';
import { Icon, ItemArt } from '@/components/ui';

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params; const api = await serverApi();
  const it = await safe(() => api.item(id), null);
  return it ? { title: `${it.title} by ${it.artist_name}`, description: `Ratings, reviews and arguments about ${it.title} on Melo.` } : { title: 'Not found' };
}

export default async function ItemPage({ params, searchParams }: P) {
  const { id } = await params; const { tab: tabParam } = await searchParams;
  const api = await serverApi();
  const it = await safe(() => api.item(id), null);
  if (!it) notFound();
  const isEp = it.type === 'episode', isShow = it.type === 'show';
  const [ratings, wiki, posts, episodes, moments, show] = await Promise.all([
    safe(() => api.ratings([id]), {}), safe(() => api.wiki('a:' + id), null), safe(() => api.feed('hot', { target: { type: 'item', id }, limit: 60 }), []),
    isShow ? safe(() => api.itemsBy({ show: id }), []) : Promise.resolve([]), isEp ? safe(() => api.moments(id), []) : Promise.resolve([]),
    it.show_id ? safe(() => api.item(it.show_id!), null) : Promise.resolve(null),
  ]);
  const editor = wiki?.updated_by ? await safe(() => api.profile(wiki.updated_by!), null) : null;
  const momentPeople = isEp ? await safe(() => api.profilesByIds([...new Set(moments.map(m => m.author))]), []) : [];
  const names = Object.fromEntries(momentPeople.map(p => [p.id, { name: p.name, color: p.color, handle: p.handle }]));
  const r = (ratings as Record<string, { avg_stars: number; n: number; histogram: number[] }>)[id];
  const tabs = isShow ? ['episodes', 'threads', 'wiki'] : isEp ? ['moments', 'reviews', 'threads', 'wiki'] : ['reviews', 'takes', 'threads', 'wiki'];
  const tab = tabs.includes(tabParam ?? '') ? tabParam! : tabs[0];
  const set = posts.filter(p => (tab === 'reviews' ? p.kind === 'review' : tab === 'takes' ? p.kind === 'take' : p.kind === 'thread'));
  const counts: Record<string, number> = { reviews: posts.filter(p => p.kind === 'review').length, takes: posts.filter(p => p.kind === 'take').length, threads: posts.filter(p => p.kind === 'thread').length, moments: moments.length, episodes: episodes.length };
  const q = encodeURIComponent(`${it.artist_name} ${it.title}`);
  const hm = Math.max(1, ...(r?.histogram ?? [0]));
  return <section className="wrap sec"><div className="two left">
    <aside className="side hero-art">
      <ItemArt item={it} />
      <div className="play-on"><a href={`https://open.spotify.com/search/${q}`} target="_blank" rel="noopener noreferrer"><Icon name="play" size={16} /> Spotify</a><a href={`https://${isEp || isShow ? 'podcasts' : 'music'}.apple.com/us/search?term=${q}`} target="_blank" rel="noopener noreferrer"><Icon name="play" size={16} /> Apple</a></div>
      {!isShow && <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><span className="rating-big">★ {r ? r.avg_stars.toFixed(1) : '–'}</span><span className="muted" style={{ fontSize: 14 }}>{r?.n ?? 0} rating{r?.n === 1 ? '' : 's'} on Melo</span></div><div className="hist" style={{ marginTop: 12 }} aria-hidden="true">{(r?.histogram ?? Array(10).fill(0)).map((v, i) => <i key={i} style={{ height: `${(v / hm) * 100}%` }} />)}</div><div className="hist-l"><span>½★</span><span>★★★★★</span></div></div>}
      {!isShow && <LogButton item={it} />}
    </aside>
    <div className="stack" style={{ gap: 20, minWidth: 0 }}>
      <div className="ent-title"><span className="eyebrow">{isEp ? 'Podcast episode' : isShow ? 'Podcast' : 'Album'}</span><h1 style={{ marginTop: 6 }}>{it.title}</h1>
        {it.artist_id ? <Link className="by" href={`/artist/${it.artist_id}`}>{it.artist_name}</Link> : show ? <Link className="by" href={`/album/${show.id}`}>{show.title}</Link> : <span className="by">{it.artist_name}</span>}</div>
      <div className="facts"><span>{flag(it.cc)} {countryName(it.cc)}</span>{it.year && <span>{it.year}</span>}{it.dur_min && <span>{it.dur_min} min</span>}{it.genre && <Link href={`/genre/${it.genre}`} style={{ color: 'var(--blue)' }}>#{genreName(it.genre)}</Link>}</div>
      <div className="seg">{tabs.map(t => <Link key={t} href={`?tab=${t}`} scroll={false} className={tab === t ? 'on' : ''}>{t[0].toUpperCase() + t.slice(1)}{t !== 'wiki' ? ` · ${counts[t]}` : ''}</Link>)}</div>
      {tab === 'wiki' && <WikiBox wikiKey={'a:' + id} initial={wiki?.body ?? ''} label={it.title} editedBy={editor?.name} editedAt={wiki?.updated_at} rev={wiki?.rev} />}
      {tab === 'moments' && <Moments itemId={id} durMin={it.dur_min} initial={moments} names={names} />}
      {tab === 'episodes' && <div className="stack">{episodes.map(e => <div key={e.id} className="card"><ItemRow it={e} size={52} /></div>)}{!episodes.length && <p className="muted">No episodes added yet. Add one from Explore.</p>}</div>}
      {['reviews', 'takes', 'threads'].includes(tab) && <div className="stack">
        {tab !== 'reviews' && <div><ComposeButton kind={tab === 'takes' ? 'take' : 'thread'} target={{ type: 'item', id }} label={tab === 'takes' ? 'Make a take' : 'Start a thread'} /></div>}
        <PostList posts={set} items={{ [id]: it }} empty={`No ${tab} yet.`} />
      </div>}
    </div>
  </div></section>;
}
