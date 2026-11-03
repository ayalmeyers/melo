import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { countryName, flag } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { BlockButton, FollowButton, MessageButton, PostList } from '@/components/interactive';
import { Avatar, ItemArt, Stars } from '@/components/ui';

type P = { params: Promise<{ handle: string }>; searchParams: Promise<{ tab?: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> { const { handle } = await params; const api = await serverApi(); const p = await safe(() => api.profileByHandle(handle), null); return p ? { title: `${p.name} (@${p.handle})`, description: p.bio || `${p.name} on Melo.` } : { title: 'Not found' }; }

export default async function ProfilePage({ params, searchParams }: P) {
  const { handle } = await params; const { tab: tp } = await searchParams;
  const api = await serverApi();
  const p = await safe(() => api.profileByHandle(handle), null); if (!p) notFound();
  const [stats, posts, diary, me] = await Promise.all([safe(() => api.stats(p.id), null), safe(() => api.feed('new', { author: p.id, limit: 60 }), []), safe(() => api.diary(p.id), []), safe(() => api.uid(), null)]);
  const ids = [...new Set([...diary.map(d => d.item_id), ...p.top4])];
  const items = Object.fromEntries((await safe(() => api.items(ids), [])).map(i => [i.id, i]));
  const tab = ['posts', 'diary', 'passport'].includes(tp ?? '') ? tp! : 'posts';
  const countries: Record<string, number> = {}; diary.forEach(d => { const it = items[d.item_id]; if (it) countries[it.cc] = (countries[it.cc] ?? 0) + 1; });
  const isMe = me === p.id;
  return <>
    <section className="band ent-band"><div className="wrap stack" style={{ gap: 20 }}>
      <div className="in"><Avatar name={p.name} color={p.color} size="xl" /><div style={{ flex: 1, minWidth: 220 }}><h1>{p.name}</h1><p className="muted" style={{ fontWeight: 600 }}>@{p.handle} · {flag(p.cc)} {p.city || countryName(p.cc)}</p>
        <div className="counts" style={{ marginTop: 10 }}><div><b>{stats?.followers ?? 0}</b><small>Followers</small></div><div><b>{stats?.following ?? 0}</b><small>Following</small></div><div><b>{stats?.logged ?? 0}</b><small>Logged</small></div>{stats?.ear != null && <div><b>{stats.ear}</b><small>Ear score</small></div>}</div></div></div>
      {p.bio && <p style={{ color: '#c3c8d4', fontSize: 17, maxWidth: '60ch' }}>{p.bio}</p>}
      <div className="row">{isMe ? <Link className="btn sm" href="/settings">Edit profile</Link> : <><FollowButton kind="user" target={p.id} dark /><MessageButton userId={p.id} /><BlockButton userId={p.id} /></>}</div>
      {p.top4.length > 0 && <div><span className="eyebrow">Top 4</span><div className="top4" style={{ marginTop: 10 }}>{p.top4.map(i => items[i] ? <Link key={i} href={`/album/${i}`} aria-label={items[i].title}><ItemArt item={items[i]} /></Link> : null)}</div></div>}
      <div className="row">{[['posts', `Posts · ${posts.length}`], ['diary', `Diary · ${diary.length}`], ['passport', 'Passport']].map(([v, l]) => <Link key={v} href={`?tab=${v}`} scroll={false} className={`chip ${tab === v ? 'on' : ''}`}>{l}</Link>)}</div>
    </div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 820 }}>
      {tab === 'posts' && <PostList posts={posts} items={items} empty="Nothing posted yet." />}
      {tab === 'diary' && (diary.length ? diary.map(d => { const it = items[d.item_id]; if (!it) return null; const dt = new Date(d.listened_at); return <Link key={d.id} href={`/album/${it.id}`} className="diary-row"><span className="day">{dt.getDate()}</span><ItemArt item={it} size={46} /><span style={{ flex: 1, minWidth: 0 }}><b>{it.title}</b><br /><small className="muted">{it.artist_name} · {dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</small></span>{d.rating && <Stars r10={d.rating} size={13} />}</Link>; }) : <p className="empty">No listens logged yet.</p>)}
      {tab === 'passport' && (Object.keys(countries).length ? <div className="passport">{Object.entries(countries).sort((a, b) => b[1] - a[1]).map(([c, n]) => <div key={c} className="visa"><span className="f">{flag(c)}</span><b>{countryName(c)}</b><small>{n} logged</small></div>)}</div> : <p className="empty">Every album logged stamps the country it came from.</p>)}
    </div></div>
  </>;
}
