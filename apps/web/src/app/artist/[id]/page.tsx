import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, GENRES, countryName, flag } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { ComposeButton, FollowButton, PostList, WikiBox } from '@/components/interactive';
import { ArtistArt, ItemArt } from '@/components/ui';

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> { const { id } = await params; const a = ARTISTS[id]; return a ? { title: a.name, description: `The ${a.name} board, wiki and discography on Melo.` } : { title: 'Not found' }; }

export default async function ArtistPage({ params, searchParams }: P) {
  const { id } = await params; const { tab: tp } = await searchParams;
  const a = ARTISTS[id]; if (!a) notFound();
  const api = await serverApi();
  const [albums, wiki, board, followers] = await Promise.all([safe(() => api.itemsBy({ artist: id }), []), safe(() => api.wiki('r:' + id), null), safe(() => api.feed('hot', { target: { type: 'artist', id }, limit: 60 }), []), safe(() => api.followCount('artist', id), 0)]);
  const albumPosts = albums.length ? await safe(async () => (await Promise.all(albums.slice(0, 10).map(al => api.feed('hot', { target: { type: 'item', id: al.id }, limit: 10 })))).flat(), []) : [];
  const editor = wiki?.updated_by ? await safe(() => api.profile(wiki.updated_by!), null) : null;
  const tab = ['board', 'wiki', 'albums'].includes(tp ?? '') ? tp! : 'board';
  const posts = [...board, ...albumPosts].sort((x, y) => y.hot - x.hot);
  const items = Object.fromEntries(albums.map(x => [x.id, x]));
  return <>
    <section className="band ent-band"><div className="wrap stack" style={{ gap: 18 }}>
      <div className="in"><ArtistArt id={id} name={a.name} size={120} /><div style={{ flex: 1, minWidth: 220 }}><span className="eyebrow">Artist</span><h1>{a.name}</h1><p className="muted" style={{ fontWeight: 600 }}>{flag(a.cc)} {countryName(a.cc)} · {followers} following</p></div></div>
      <div className="row"><FollowButton kind="artist" target={id} dark />{a.genres.map(g => <Link key={g} className="chip" href={`/genre/${g}`}>#{GENRES[g].name}</Link>)}</div>
      <div className="row">{[['board', 'Board'], ['wiki', 'Wiki'], ['albums', `Albums · ${albums.length}`]].map(([v, l]) => <Link key={v} href={`?tab=${v}`} scroll={false} className={`chip ${tab === v ? 'on' : ''}`}>{l}</Link>)}</div>
    </div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 820 }}>
      {tab === 'wiki' && <WikiBox wikiKey={'r:' + id} initial={wiki?.body ?? a.wiki} label={a.name} editedBy={editor?.name} editedAt={wiki?.updated_at} rev={wiki?.rev} />}
      {tab === 'albums' && <div className="g3">{albums.map(al => <Link key={al.id} href={`/album/${al.id}`} className="cover-tile"><ItemArt item={al} /><b>{al.title}</b><small>{al.year}</small></Link>)}</div>}
      {tab === 'board' && <div className="stack"><div><ComposeButton kind="thread" target={{ type: 'artist', id }} label="Start a discussion" /></div><PostList posts={posts} items={items} empty={`No posts about ${a.name} yet.`} /></div>}
    </div></div>
  </>;
}
