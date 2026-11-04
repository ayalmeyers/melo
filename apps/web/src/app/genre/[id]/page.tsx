import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, GENRES, flag, type Artist } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { ComposeButton, FollowButton, PostList, WikiBox } from '@/components/interactive';
import { ArtistArt, GenreArt, ItemArt } from '@/components/ui';

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> { const { id } = await params; const g = GENRES[id]; return g ? { title: g.name, description: `The ${g.name} board and wiki on Melo.` } : { title: 'Not found' }; }

export default async function GenrePage({ params, searchParams }: P) {
  const { id } = await params; const { tab: tp } = await searchParams;
  const g = GENRES[id]; if (!g) notFound();
  const api = await serverApi();
  const artists: Artist[] = await safe(() => api.artistsByGenre(id, 200), Object.entries(ARTISTS).filter(([, a]) => a.genres.includes(id)).map(([aid, a]) => ({ id: aid, name: a.name, cc: a.cc, genres: a.genres })));
  const [albums, wiki, board, followers] = await Promise.all([safe(() => api.itemsBy({ genre: id }), []), safe(() => api.wiki('g:' + id), null), safe(() => api.feed('hot', { target: { type: 'genre', id }, limit: 60 }), []), safe(() => api.followCount('genre', id), 0)]);
  const editor = wiki?.updated_by ? await safe(() => api.profile(wiki.updated_by!), null) : null;
  const tab = ['board', 'wiki', 'artists', 'albums'].includes(tp ?? '') ? tp! : 'board';
  return <>
    <section className="band ent-band"><div className="wrap stack" style={{ gap: 18 }}>
      <div className="in"><GenreArt id={id} size={120} /><div style={{ flex: 1, minWidth: 220 }}><span className="eyebrow">Genre</span><h1>{g.name}</h1><p className="muted" style={{ fontWeight: 600 }}>{followers} following · {artists.length} artists</p></div></div>
      <div className="row"><FollowButton kind="genre" target={id} dark /></div>
      <div className="row">{[['board', 'Board'], ['wiki', 'Wiki'], ['artists', `Artists · ${artists.length}`], ['albums', `${id === 'podcasts' ? 'Shows' : 'Albums'} · ${albums.length}`]].map(([v, l]) => <Link key={v} href={`?tab=${v}`} scroll={false} className={`chip ${tab === v ? 'on' : ''}`}>{l}</Link>)}</div>
    </div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 820 }}>
      {tab === 'wiki' && <WikiBox wikiKey={'g:' + id} initial={wiki?.body ?? g.wiki} label={g.name} editedBy={editor?.name} editedAt={wiki?.updated_at} rev={wiki?.rev} />}
      {tab === 'artists' && <div className="stack">{artists.map(a => <Link key={a.id} href={`/artist/${a.id}`} className="list-row"><ArtistArt id={a.id} name={a.name} art={a.artwork_url} size={52} /><span className="m"><b>{a.name}</b><small>{flag(a.cc)}</small></span></Link>)}</div>}
      {tab === 'albums' && <div className="g3">{albums.map(al => <Link key={al.id} href={`/album/${al.id}`} className="cover-tile"><ItemArt item={al} /><b>{al.title}</b><small>{al.artist_name}</small></Link>)}</div>}
      {tab === 'board' && <div className="stack"><div><ComposeButton kind="thread" target={{ type: 'genre', id }} label="Start a discussion" /></div><PostList posts={board} empty={`The ${g.name} board is empty. Start it.`} /></div>}
    </div></div>
  </>;
}
