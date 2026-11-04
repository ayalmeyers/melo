'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  type Artist,
  ARTISTS, CNAME, EMAIL_RE, FLAG, GENRES, LIMITS, SHOWS, ago, flag, genreName, mmss, parseTimestamp, starsText,
  type CatalogItem, type Comment, type FeedPost, type FollowKind, type Moment, type Target,
} from '@melo/core';
import { useMelo } from './session';
import { AppleSection, useAppleSearch } from './apple';
import { ArtistArt, Avatar, GenreArt, Icon, ItemArt, Stars } from './ui';

/* ---------------- nav ---------------- */
/** Bell with a live unread count. */
function Bell() {
  const { api, user } = useMelo();
  const [n, setN] = useState(0);
  const path = usePathname();
  useEffect(() => {
    if (!user) return;
    api.unreadCount().then(setN).catch(() => {});
    return api.onNotifications(user.id, x => { if (x.kind !== 'message') setN(c => c + 1); });
  }, [api, user, path]);
  return <Link href="/activity" className="bell" aria-label={n ? `Notifications, ${n} new` : 'Notifications'}><Icon name="bell" size={21} />{n > 0 && <span className="badge">{n > 99 ? '99+' : n}</span>}</Link>;
}

export function Nav() {
  const { user, profile, openCompose } = useMelo();
  const path = usePathname();
  const links: [string, string][] = [['/feed', 'Feed'], ['/explore', 'Explore'], ['/charts', 'Charts'], ['/forecasts', 'Forecasts'], ['/chats', 'Chats']];
  const cur = (h: string) => path === h || path.startsWith(h + '/');
  return (
    <nav className="nav" aria-label="Main">
      <div className="wrap">
        <div className="nav-in">
          <Link className="logo" href="/" aria-label="Melo home"><span className="disc" aria-hidden="true" />melo</Link>
          <div className="nav-links">{links.map(([h, l]) => <Link key={h} href={h} aria-current={cur(h) ? 'page' : undefined}>{l}</Link>)}</div>
          <div className="nav-right">
            {user && profile ? <>
              <Bell />
              <button className="btn sm" onClick={() => openCompose()}><Icon name="plus" size={18} /> Post</button>
              <Link href={`/u/${profile.handle}`} aria-label="Your profile"><Avatar name={profile.name} color={profile.color} /></Link>
            </> : <Link className="btn sm" href="/login">Sign in</Link>}
          </div>
        </div>
        <div className="subnav">{links.map(([h, l]) => <Link key={h} className={`chip ${cur(h) ? 'on' : ''}`} href={h}>{l}</Link>)}</div>
      </div>
    </nav>
  );
}

/* ---------------- waitlist ---------------- */
export function WaitlistForm({ source = 'home' }: { source?: string }) {
  const { api } = useMelo();
  const [email, setEmail] = useState(''); const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle'); const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setState('error'); setMsg('That email looks incomplete. Check it and try again.'); return; }
    setState('saving');
    try { await api.joinWaitlist(email, { source }); setState('done'); } catch (err) { setState('error'); setMsg((err as Error).message); }
  }
  if (state === 'done') return <p className="ok" style={{ marginTop: 24, fontSize: 17 }}>You&apos;re on the list. We&apos;ll email {email} when your invite is ready.</p>;
  return (
    <form onSubmit={submit} noValidate>
      <div className="wl"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email address" autoComplete="email" required /><button className="btn" disabled={state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Get early access'}</button></div>
      {state === 'error' && <p className="err" style={{ marginTop: 10 }}>{msg}</p>}
    </form>
  );
}

/* ---------------- targets ---------------- */
const artistCache = new Map<string, Promise<Artist | null>>();
/** Artist name and art for imported artists (seeded ones are known up front). */
export function useArtist(id: string | null | undefined) {
  const { api } = useMelo();
  const [a, setA] = useState<Artist | null>(id && ARTISTS[id] ? { id, name: ARTISTS[id].name, cc: ARTISTS[id].cc, genres: ARTISTS[id].genres } : null);
  useEffect(() => {
    if (!id) return;
    if (!artistCache.has(id)) artistCache.set(id, api.artist(id).catch(() => null));
    let alive = true; artistCache.get(id)!.then(r => { if (alive && r) setA(r); }); return () => { alive = false; };
  }, [api, id]);
  return a;
}
function ArtistChip({ id }: { id: string }) {
  const a = useArtist(id);
  return <Link className="tchip" href={`/artist/${id}`}><ArtistArt id={id} name={a?.name} art={a?.image_url ?? a?.artwork_url} size={24} /><span>{a?.name ?? 'Artist'}</span></Link>;
}
export function TargetChip({ t, items }: { t: Target; items?: Record<string, CatalogItem> }) {
  if (t.type === 'artist') return <ArtistChip id={t.id} />;
  if (t.type === 'genre') { const g = GENRES[t.id]; return g ? <Link className="tchip" href={`/genre/${t.id}`}><span className="gdot">#</span><span>{g.name}</span></Link> : null; }
  const it = items?.[t.id];
  return <Link className="tchip" href={`/album/${t.id}`}>{it && <ItemArt item={it} size={24} />}<span>{it ? `${it.title} · ${it.artist_name}` : 'Open'}</span></Link>;
}
export function ItemRow({ it, size = 64, extra }: { it: CatalogItem; size?: number; extra?: React.ReactNode }) {
  return <Link className="item-row" href={`/album/${it.id}`}><ItemArt item={it} size={size} /><span className="txt"><span className="t">{it.title}</span><span className="a">{it.artist_name}</span><span className="y">{flag(it.cc)} {it.type === 'album' ? `${it.year ?? ''} · ${genreName(it.genre)}` : it.type === 'episode' ? `Episode${it.dur_min ? ` · ${it.dur_min} min` : ''}` : 'Podcast'}</span>{extra}</span></Link>;
}

/* ---------------- posts ---------------- */
const KIND: Record<string, string> = { review: 'Review', take: 'Take', thread: 'Thread' };
function PostCard({ p, items, mine, onChange, full }: { p: FeedPost; items: Record<string, CatalogItem>; mine: { vote?: 'agree' | 'disagree'; like?: boolean; laugh?: boolean }; onChange: () => void; full?: boolean }) {
  const { api, user, requireSignIn, toast } = useMelo();
  const router = useRouter();
  const [local, setLocal] = useState(mine);
  const [counts, setCounts] = useState({ likes: p.likes, laughs: p.laughs, agree: p.agree, disagree: p.disagree });
  useEffect(() => setLocal(mine), [mine]);
  const it = p.target_type === 'item' && p.target_id ? items[p.target_id] : null;
  async function vote(v: 'agree' | 'disagree') {
    if (!requireSignIn()) return;
    const next = local.vote === v ? undefined : v;
    const c = { ...counts }; if (local.vote) c[local.vote]--; if (next) c[next]++;
    setLocal({ ...local, vote: next }); setCounts(c);
    try { await api.vote(p.id, next ?? null); } catch (e) { toast((e as Error).message); onChange(); }
  }
  async function react(k: 'like' | 'laugh') {
    if (!requireSignIn()) return;
    const on = !local[k]; const key = k === 'like' ? 'likes' : 'laughs';
    setLocal({ ...local, [k]: on }); setCounts({ ...counts, [key]: counts[key] + (on ? 1 : -1) });
    try { await api.react('post', p.id, k, on); } catch (e) { toast((e as Error).message); }
  }
  async function del() { if (!confirm('Delete this post?')) return; try { await api.deletePost(p.id); toast('Deleted'); router.push('/feed'); } catch (e) { toast((e as Error).message); } }
  async function report() { if (!requireSignIn()) return; try { await api.report('post', p.id); toast('Reported. A moderator will review it.'); } catch (e) { toast((e as Error).message); } }
  async function share() { const url = `${location.origin}/p/${p.id}`; try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); } }
  const t = p.target_type && p.target_id ? { type: p.target_type, id: p.target_id } as Target : null;
  const total = counts.agree + counts.disagree, pa = total ? Math.round((counts.agree / total) * 100) : 0;
  return (
    <article className="post">
      <div className="post-h"><Link href={`/u/${p.author_handle}`}><Avatar name={p.author_name} color={p.author_color} /></Link><Link className="meta" href={`/u/${p.author_handle}`}><b>{p.author_name}</b><small>@{p.author_handle} · {ago(p.created_at)} {flag(p.author_cc)}</small></Link><span className={`kind ${p.kind}`}>{KIND[p.kind]}</span></div>
      {p.kind === 'review' && it && <ItemRow it={it} size={70} extra={p.rating ? <span style={{ marginTop: 2 }}><Stars r10={p.rating} /></span> : null} />}
      {p.kind === 'review' && p.body && <Link href={`/p/${p.id}`}><p className={`body-text ${full ? '' : 'clamp'}`}>{p.body}</p></Link>}
      {p.kind === 'take' && <><Link href={`/p/${p.id}`}><p className="take-text">{p.body}</p></Link>{t && <div><TargetChip t={t} items={items} /></div>}
        <div className="vote"><button className={`agree ${local.vote === 'agree' ? 'mine' : ''}`} onClick={() => vote('agree')}><span className="fill" style={{ width: `${local.vote && total ? pa : 0}%` }} /><span>Agree</span><span className="pct">{local.vote && total ? pa + '%' : ''}</span></button><button className={`disagree ${local.vote === 'disagree' ? 'mine' : ''}`} onClick={() => vote('disagree')}><span className="fill" style={{ width: `${local.vote && total ? 100 - pa : 0}%` }} /><span>Disagree</span><span className="pct">{local.vote && total ? 100 - pa + '%' : ''}</span></button></div>
        <p className="vote-note">{total} vote{total === 1 ? '' : 's'}{local.vote ? '' : ' · vote to see the split'}</p></>}
      {p.kind === 'thread' && <><Link href={`/p/${p.id}`}><p className="thread-title">{p.title}</p>{p.body && <p className={`body-text ${full ? '' : 'clamp'}`} style={{ color: '#3c4250', marginTop: 6 }}>{p.body}</p>}</Link>{t && <div><TargetChip t={t} items={items} /></div>}</>}
      <div className="actions">
        <button className={`act heart ${local.like ? 'on' : ''}`} onClick={() => react('like')} aria-pressed={!!local.like} aria-label="Like"><Icon name="heart" size={19} /><span>{counts.likes}</span></button>
        <button className={`act ${local.laugh ? 'on' : ''}`} onClick={() => react('laugh')} aria-pressed={!!local.laugh} aria-label="Laugh"><Icon name="laugh" size={19} /><span>{counts.laughs}</span></button>
        <Link className="act" href={`/p/${p.id}`} aria-label="Replies"><Icon name="comment" size={19} /><span>{p.comment_count}</span></Link>
        <span className="spacer" />
        {full && user && user.id === p.author && <button className="act" onClick={del} aria-label="Delete"><Icon name="trash" size={18} /></button>}
        {full && user && user.id !== p.author && <button className="act" onClick={report} aria-label="Report"><Icon name="flag" size={18} /></button>}
        <button className="act" onClick={share} aria-label="Copy link"><Icon name="link" size={19} /></button>
      </div>
    </article>
  );
}

export function PostList({ posts, items: given, full, empty = 'Nothing here yet.' }: { posts: FeedPost[]; items?: Record<string, CatalogItem>; full?: boolean; empty?: string }) {
  const { api, user } = useMelo();
  const [items, setItems] = useState<Record<string, CatalogItem>>(given ?? {});
  const [votes, setVotes] = useState<Record<string, 'agree' | 'disagree'>>({});
  const [reacts, setReacts] = useState<Set<string>>(new Set());
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const ids = useMemo(() => posts.map(p => p.id), [posts]);
  const load = useCallback(async () => {
    const need = posts.filter(p => p.target_type === 'item' && p.target_id && !items[p.target_id]).map(p => p.target_id!);
    if (need.length) { const rows = await api.items([...new Set(need)]); setItems(prev => ({ ...prev, ...Object.fromEntries(rows.map(r => [r.id, r])) })); }
    if (user) { setVotes(await api.myVotes(ids)); setReacts(await api.myReactions(ids)); setBlocked(await api.blocked()); }
  }, [api, user, ids, posts, items]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => {}); }, [user, ids.join(',')]);
  const shown = posts.filter(p => !blocked.has(p.author));
  if (!shown.length) return <p className="empty">{empty}</p>;
  return <div className="stack">{shown.map(p => <PostCard key={p.id} p={p} items={items} full={full} onChange={load} mine={{ vote: votes[p.id], like: reacts.has(p.id + ':like'), laugh: reacts.has(p.id + ':laugh') }} />)}</div>;
}

/* ---------------- client feed ---------------- */
export function Feed() {
  const { api, user, follows, ready } = useMelo();
  const [mode, setMode] = useState<'hot' | 'new' | 'following'>('hot');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    setPosts(null);
    const targets: Target[] = [...[...follows.artists].map(id => ({ type: 'artist' as const, id })), ...[...follows.genres].map(id => ({ type: 'genre' as const, id }))];
    const authors = user ? [...follows.users, user.id] : [];
    api.feed(mode, { limit: 40, targets, authors }).then(setPosts).catch(() => setPosts([]));
  }, [api, mode, follows, user, ready]);
  return <>
    <div className="seg" style={{ marginBottom: 18 }}>{([['hot', 'Hot'], ['new', 'Newest'], ['following', 'Following']] as const).map(([v, l]) => <button key={v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>)}</div>
    {posts === null ? <p className="empty">Loading…</p> : <PostList posts={posts} empty={mode === 'following' ? 'Follow people, artists and genres and their posts land here.' : 'Nothing posted yet. Be the first take this place ever had.'} />}
  </>;
}

/* ---------------- follow ---------------- */
export function FollowButton({ kind, target, label = 'Follow', dark }: { kind: FollowKind; target: string; label?: string; dark?: boolean }) {
  const { api, follows, setFollows, requireSignIn, toast, user } = useMelo();
  const set = kind === 'user' ? follows.users : kind === 'artist' ? follows.artists : follows.genres;
  const on = set.has(target);
  if (user && kind === 'user' && user.id === target) return null;
  async function toggle() {
    if (!requireSignIn()) return;
    const next = new Set(set); on ? next.delete(target) : next.add(target);
    setFollows({ ...follows, [kind === 'user' ? 'users' : kind === 'artist' ? 'artists' : 'genres']: next });
    try { await api.follow(kind, target, !on); } catch (e) { toast((e as Error).message); }
  }
  return <button className={`btn sm ${on ? (dark ? 'dark' : 'ghost') : ''}`} onClick={toggle}>{on ? <><Icon name="check" size={16} /> Following</> : <><Icon name="plus" size={16} /> {label}</>}</button>;
}

export function BlockButton({ userId }: { userId: string }) {
  const { api, requireSignIn, toast, user } = useMelo();
  const [on, setOn] = useState(false);
  useEffect(() => { if (user) api.blocked().then(s => setOn(s.has(userId))).catch(() => {}); }, [api, user, userId]);
  if (user?.id === userId) return null;
  return <button className="chip" onClick={async () => { if (!requireSignIn()) return; if (!on && !confirm('Block this person? You will stop seeing their posts and they cannot message you.')) return; try { await api.block(userId, !on); setOn(!on); toast(on ? 'Unblocked' : 'Blocked'); } catch (e) { toast((e as Error).message); } }}>{on ? 'Unblock' : 'Block'}</button>;
}

export function MessageButton({ userId }: { userId: string }) {
  const { api, requireSignIn, toast, user } = useMelo(); const router = useRouter();
  if (user?.id === userId) return null;
  return <button className="chip" onClick={async () => { if (!requireSignIn()) return; try { const id = await api.openDm(userId); router.push(`/chats/${id}`); } catch (e) { toast((e as Error).message); } }}><Icon name="chat" size={17} /> Message</button>;
}

/* ---------------- wiki ---------------- */
export function WikiBox({ wikiKey, initial, label, editedBy, editedAt, rev }: { wikiKey: string; initial: string; label: string; editedBy?: string | null; editedAt?: string | null; rev?: number }) {
  const { api, requireSignIn, toast } = useMelo(); const router = useRouter();
  const [editing, setEditing] = useState(false); const [body, setBody] = useState(initial); const [saving, setSaving] = useState(false);
  async function save() {
    if (body.trim().length < 20) { toast('A wiki needs at least a sentence or two.'); return; }
    setSaving(true);
    try { await api.editWiki(wikiKey, body); toast('Wiki updated'); setEditing(false); router.refresh(); } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  }
  if (editing) return <div className="card stack"><p className="muted" style={{ fontSize: 14 }}>Facts, history and context. Opinions belong on the board. Separate paragraphs with a blank line.</p><textarea className="inp" style={{ minHeight: 260, background: '#fff' }} value={body} onChange={e => setBody(e.target.value)} aria-label="Wiki text" maxLength={20000} /><div className="row"><button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save revision'}</button><button className="btn ghost" onClick={() => { setBody(initial); setEditing(false); }}>Cancel</button></div></div>;
  return <div className="card stack"><div className="wiki">{initial ? initial.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>) : <p className="muted">No wiki for {label} yet. Start it with what you know.</p>}</div><div className="wiki-meta"><span>{editedBy ? `Edited by ${editedBy} · ${editedAt ? ago(editedAt) : ''} ago · revision ${rev}` : 'Starter text from Melo'}</span><button className="act" style={{ color: 'var(--blue)' }} onClick={() => { if (requireSignIn()) setEditing(true); }}><Icon name="pen" size={15} /> Edit</button></div></div>;
}

/* ---------------- comments ---------------- */
export function Comments({ on, initial }: { on: { post?: string; forecast?: string }; initial: Comment[] }) {
  const { api, user, requireSignIn, toast } = useMelo();
  const [list, setList] = useState(initial); const [body, setBody] = useState(''); const [replyTo, setReplyTo] = useState<Comment | null>(null); const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const reload = useCallback(async () => setList(await api.comments(on)), [api, on]);
  useEffect(() => { if (user) api.myReactions(list.map(c => c.id)).then(setLiked).catch(() => {}); }, [api, user, list]);
  async function send() {
    if (!requireSignIn()) return; if (!body.trim()) return;
    setBusy(true);
    try { await api.addComment(on, body.trim().slice(0, LIMITS.comment), replyTo?.id); setBody(''); setReplyTo(null); await reload(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  const top = list.filter(c => !c.reply_to || !list.some(x => x.id === c.reply_to));
  const ordered: Comment[] = []; top.forEach(t => { ordered.push(t); list.filter(c => c.reply_to === t.id).forEach(r => ordered.push(r)); });
  return <div className="stack">
    <h2 style={{ fontSize: 22 }}>{list.length} {list.length === 1 ? 'reply' : 'replies'}</h2>
    <div className="comments">{ordered.map(c => <div key={c.id} className={`cmt ${c.reply_to ? 'reply' : ''}`}><Avatar name={c.author_name} color={c.author_color} size={c.reply_to ? 'xs' : ''} /><div className="bubble"><div className="hd"><Link href={`/u/${c.author_handle}`}><b>{c.author_name}</b></Link><small>{ago(c.created_at)}</small></div><p>{c.body}</p><div className="ca">
      <button className={liked.has(c.id + ':like') ? 'on' : ''} onClick={async () => { if (!requireSignIn()) return; const on2 = !liked.has(c.id + ':like'); const n = new Set(liked); on2 ? n.add(c.id + ':like') : n.delete(c.id + ':like'); setLiked(n); try { await api.react('comment', c.id, 'like', on2); } catch (e) { toast((e as Error).message); } }}>{liked.has(c.id + ':like') ? 'Liked' : 'Like'} · {c.likes + (liked.has(c.id + ':like') ? 1 : 0)}</button>
      {on.post && <button onClick={() => setReplyTo(c)}>Reply</button>}
      {user?.id === c.author ? <button onClick={async () => { try { await api.deleteComment(c.id); await reload(); } catch (e) { toast((e as Error).message); } }}>Delete</button> : user && <button onClick={async () => { try { await api.report('comment', c.id); toast('Reported'); } catch (e) { toast((e as Error).message); } }}>Report</button>}
    </div></div></div>)}{!list.length && <p className="muted">No replies yet. Start the argument.</p>}</div>
    <div className="card stack">{replyTo && <p className="muted" style={{ fontSize: 14 }}>Replying to {replyTo.author_name} · <button style={{ color: 'var(--blue)' }} onClick={() => setReplyTo(null)}>Cancel</button></p>}<textarea className="inp" style={{ background: '#fff', minHeight: 80 }} placeholder="Add a reply" value={body} onChange={e => setBody(e.target.value)} maxLength={LIMITS.comment} aria-label="Reply" /><div><button className="btn sm" onClick={send} disabled={busy || !body.trim()}>Reply</button></div></div>
  </div>;
}

/* ---------------- log / review entry ---------------- */
export function LogButton({ item }: { item: CatalogItem }) {
  const { openCompose } = useMelo();
  return <button className="btn block" onClick={() => openCompose({ kind: 'review', target: { type: 'item', id: item.id } })}><Icon name="plus" size={18} /> Rate and review</button>;
}

export function ComposeButton({ kind, target, label }: { kind: 'review' | 'take' | 'thread' | 'forecast'; target?: Target; label: string }) {
  const { openCompose } = useMelo();
  return <button className="btn ghost" onClick={() => openCompose({ kind, target })}><Icon name="pen" size={18} /> {label}</button>;
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const at = (x: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(1, Math.min(10, Math.ceil(((x - r.left) / r.width) * 10))); };
  return <span ref={ref} className="star-input" role="slider" tabIndex={0} aria-label="Rating" aria-valuemin={0} aria-valuemax={5} aria-valuenow={value / 2}
    onPointerDown={e => { onChange(at(e.clientX)); (e.target as Element).setPointerCapture?.(e.pointerId); }} onPointerMove={e => { if (e.buttons) onChange(at(e.clientX)); }}
    onKeyDown={e => { if (e.key === 'ArrowRight') onChange(Math.min(10, value + 1)); if (e.key === 'ArrowLeft') onChange(Math.max(0, value - 1)); }}><Stars r10={value} size={34} /></span>;
}

/* ---------------- compose modal ---------------- */
export function ComposeModal() {
  const { compose, closeCompose, api, toast } = useMelo(); const router = useRouter();
  const [kind, setKind] = useState<'review' | 'take' | 'thread' | 'forecast'>('review');
  const [target, setTarget] = useState<Target | null>(null); const [targetItem, setTargetItem] = useState<CatalogItem | null>(null);
  const [q, setQ] = useState(''); const [results, setResults] = useState<CatalogItem[]>([]); const [artistHits, setArtistHits] = useState<Artist[]>([]);
  const [rating, setRating] = useState(0); const [liked, setLiked] = useState(false);
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [detail, setDetail] = useState(''); const [closes, setCloses] = useState(''); const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false); const [adding, setAdding] = useState(false);
  useEffect(() => { if (compose) { setKind(compose.kind ?? 'review'); setTarget(compose.target ?? null); setRating(0); setTitle(''); setBody(''); setDetail(''); setCloses(''); setQ(''); setLiked(false); setSpoiler(false); setAdding(false); } }, [compose]);
  useEffect(() => { if (target?.type === 'item') api.item(target.id).then(setTargetItem).catch(() => setTargetItem(null)); else setTargetItem(null); }, [api, target]);
  useEffect(() => { const t = setTimeout(() => { if (q.trim()) { api.searchItems(q, 8).then(setResults).catch(() => {}); api.searchArtists(q, 4).then(setArtistHits).catch(() => {}); } else { setResults([]); setArtistHits([]); } }, 200); return () => clearTimeout(t); }, [api, q]);
  const fromApple = useAppleSearch(compose && !target ? q : '', ['album', 'episode'], 6);
  const targetArtist = useArtist(target?.type === 'artist' ? target.id : null);
  if (!compose) return null;
  const lim = kind === 'take' ? LIMITS.take : kind === 'thread' ? LIMITS.thread : kind === 'forecast' ? LIMITS.question : LIMITS.review;
  const genreHits = q.trim() ? Object.entries(GENRES).filter(([, g]) => g.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3) : [];
  async function submit() {
    setBusy(true);
    try {
      if (kind === 'review') {
        if (!target || target.type !== 'item') throw new Error('Pick what you listened to.');
        if (!rating && !body.trim()) throw new Error('Add a rating or a few words.');
        await api.log(target.id, rating || null, liked);
        if (body.trim()) { if (!rating) throw new Error('Reviews need a rating.'); const id = await api.createPost({ kind: 'review', target, rating, body: body.trim(), spoiler }); closeCompose(); toast('Posted'); router.push(`/p/${id}`); }
        else { closeCompose(); toast('Logged to your diary'); router.refresh(); }
      } else if (kind === 'take') {
        if (!body.trim()) throw new Error('A take needs words.');
        const id = await api.createPost({ kind: 'take', target, body: body.trim() }); closeCompose(); toast('Posted'); router.push(`/p/${id}`);
      } else if (kind === 'thread') {
        if (!title.trim()) throw new Error('Give the thread a title.');
        const id = await api.createPost({ kind: 'thread', target, title: title.trim(), body: body.trim() }); closeCompose(); toast('Posted'); router.push(`/p/${id}`);
      } else {
        if (body.trim().length < 10) throw new Error('Write the question.');
        if (!closes || new Date(closes) <= new Date()) throw new Error('Pick a closing date in the future.');
        const id = await api.ask({ question: body.trim(), detail: detail.trim(), closes_on: closes, target }); closeCompose(); toast('Question posted'); router.push(`/forecasts/${id}`);
      }
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  const targetLabel = target ? target.type === 'artist' ? targetArtist?.name ?? 'Artist' : target.type === 'genre' ? '#' + GENRES[target.id]?.name : targetItem ? `${targetItem.title} · ${targetItem.artist_name}` : '…' : null;
  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) closeCompose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="compose-h">
        <div className="modal-h"><h2 id="compose-h">{{ review: 'Log and review', take: 'Make a take', thread: 'Start a thread', forecast: 'Ask the crowd' }[kind]}</h2><button className="x" onClick={closeCompose} aria-label="Close"><Icon name="x" size={18} /></button></div>
        <div className="seg">{(['review', 'take', 'thread', 'forecast'] as const).map(k => <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); if (k === 'review' && target && target.type !== 'item') setTarget(null); }}>{{ review: 'Review', take: 'Take', thread: 'Thread', forecast: 'Forecast' }[k]}</button>)}</div>
        {adding ? <AddItemForm initialTitle={q} onDone={id => { setAdding(false); if (id) { setTarget({ type: 'item', id }); setQ(''); } }} />
          : target ? <div className="card row" style={{ padding: 10 }}>{target.type === 'item' && targetItem ? <ItemArt item={targetItem} size={48} /> : target.type === 'artist' ? <ArtistArt id={target.id} name={targetArtist?.name} art={targetArtist?.image_url ?? targetArtist?.artwork_url} size={48} /> : <GenreArt id={target.id} size={48} />}<b style={{ flex: 1, minWidth: 0 }}>{targetLabel}</b><button className="x" onClick={() => setTarget(null)} aria-label="Change"><Icon name="x" size={16} /></button></div>
          : <div className="field"><label htmlFor="pick-q">{kind === 'review' ? 'What did you listen to?' : 'About an album, artist or genre (optional)'}</label><input id="pick-q" className="inp" value={q} onChange={e => setQ(e.target.value)} placeholder="Search" autoComplete="off" />
            <div className="pick">
              {results.filter(r => kind !== 'review' || r.type !== 'show').map(r => <button key={r.id} onClick={() => setTarget({ type: 'item', id: r.id })}><ItemArt item={r} size={44} /><span><b>{r.title}</b><br /><small className="muted">{r.artist_name} · {r.type}</small></span></button>)}
              {kind !== 'review' && artistHits.map(a => <button key={a.id} onClick={() => setTarget({ type: 'artist', id: a.id })}><ArtistArt id={a.id} name={a.name} art={a.image_url ?? a.artwork_url} size={44} /><span><b>{a.name}</b><br /><small className="muted">Artist</small></span></button>)}
              {kind !== 'review' && genreHits.map(([id, g]) => <button key={id} onClick={() => setTarget({ type: 'genre', id })}><GenreArt id={id} size={44} /><span><b>#{g.name}</b><br /><small className="muted">Genre</small></span></button>)}
              <AppleSection title="More from Apple" results={fromApple} have={new Set(results.map(r => r.id))} onPick={id => { setTarget({ type: 'item', id }); setQ(''); }} />
              {q.trim() && <button onClick={() => setAdding(true)}><span className="art" style={{ width: 44, display: 'grid', placeItems: 'center' }}><Icon name="plus" /></span><span><b>Add “{q}” to Melo</b><br /><small className="muted">An album or podcast episode that is missing</small></span></button>}
            </div></div>}
        {kind === 'review' && <div className="field"><label>Your rating</label><div className="row"><StarInput value={rating} onChange={setRating} /><b style={{ fontSize: 20 }}>{rating ? starsText(rating) : '–'}</b><button className={`act heart ${liked ? 'on' : ''}`} onClick={() => setLiked(!liked)} aria-pressed={liked} aria-label="Like"><Icon name="heart" size={24} /></button></div></div>}
        {kind === 'thread' && <div className="field"><label htmlFor="c-title">Title</label><input id="c-title" className="inp" value={title} onChange={e => setTitle(e.target.value)} maxLength={LIMITS.threadTitle} placeholder="Ask something people will argue about" /></div>}
        {kind === 'forecast' && <p className="notice">Ask a yes-or-no question about music that will have a clear answer by a date.</p>}
        <div className="field"><label htmlFor="c-body">{{ review: 'Review (optional)', take: 'Your take', thread: 'Body', forecast: 'Question' }[kind]}</label><textarea id="c-body" className="inp" value={body} onChange={e => setBody(e.target.value)} placeholder={{ review: 'Say what it did to you. Funny counts.', take: 'One sentence. Make it hurt a little.', thread: 'Set up the discussion.', forecast: 'Will …?' }[kind]} /><small className={body.length > lim ? 'err' : 'muted'} style={{ textAlign: 'right', fontSize: 12.5 }}>{body.length} / {lim}</small></div>
        {kind === 'review' && <label className="row" style={{ fontWeight: 600 }}><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} /> Contains spoilers</label>}
        {kind === 'forecast' && <><div className="field"><label htmlFor="c-detail">How it resolves</label><textarea id="c-detail" className="inp" style={{ minHeight: 70 }} value={detail} onChange={e => setDetail(e.target.value)} maxLength={LIMITS.detail} placeholder="What counts as yes, and which source decides" /></div><div className="field"><label htmlFor="c-closes">Closes on</label><input id="c-closes" type="date" className="inp" value={closes} onChange={e => setCloses(e.target.value)} /></div></>}
        <button className="btn block" onClick={submit} disabled={busy || body.length > lim}>{busy ? 'Saving…' : kind === 'review' ? 'Save to diary' : kind === 'forecast' ? 'Ask the crowd' : 'Post'}</button>
      </div>
    </div>
  );
}

/* ---------------- add to catalog ---------------- */
export function AddItemForm({ initialTitle = '', onDone }: { initialTitle?: string; onDone: (id: string | null) => void }) {
  const { api, toast } = useMelo();
  const [type, setType] = useState<'album' | 'episode'>('album');
  const [title, setTitle] = useState(initialTitle); const [artist, setArtist] = useState(''); const [year, setYear] = useState(''); const [genre, setGenre] = useState('pop'); const [cc, setCc] = useState('US');
  const [show, setShow] = useState(SHOWS[0][0]); const [dur, setDur] = useState(''); const [busy, setBusy] = useState(false);
  async function save() {
    if (!title.trim()) { toast('Add a title.'); return; }
    setBusy(true);
    try {
      let id: string;
      if (type === 'episode') { const s = SHOWS.find(x => x[0] === show)!; id = await api.addItem({ type, title: title.trim(), artist_name: s[1], show_id: show, cc: s[3], genre: 'podcasts', dur_min: Number(dur) || null }); }
      else { if (!artist.trim()) { toast('Add the artist.'); setBusy(false); return; } const aid = Object.keys(ARTISTS).find(k => ARTISTS[k].name.toLowerCase() === artist.trim().toLowerCase()) ?? null; id = await api.addItem({ type, title: title.trim(), artist_name: artist.trim(), artist_id: aid, year: Number(year) || null, genre, cc: aid ? ARTISTS[aid].cc : cc }); }
      toast('Added to Melo'); onDone(id);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="card stack">
    <b>Add to Melo</b>
    <div className="seg"><button className={type === 'album' ? 'on' : ''} onClick={() => setType('album')}>Album</button><button className={type === 'episode' ? 'on' : ''} onClick={() => setType('episode')}>Podcast episode</button></div>
    <div className="field"><label htmlFor="ai-title">Title</label><input id="ai-title" className="inp" style={{ background: '#fff' }} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} /></div>
    {type === 'episode' ? <><div className="field"><label htmlFor="ai-show">Show</label><select id="ai-show" className="inp" style={{ background: '#fff' }} value={show} onChange={e => setShow(e.target.value)}>{SHOWS.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></div><div className="field"><label htmlFor="ai-dur">Length in minutes</label><input id="ai-dur" type="number" className="inp" style={{ background: '#fff' }} value={dur} onChange={e => setDur(e.target.value)} /></div></>
      : <><div className="field"><label htmlFor="ai-artist">Artist</label><input id="ai-artist" list="ai-artists" className="inp" style={{ background: '#fff' }} value={artist} onChange={e => setArtist(e.target.value)} /><datalist id="ai-artists">{Object.values(ARTISTS).map(a => <option key={a.name} value={a.name} />)}</datalist></div>
        <div className="g2" style={{ gap: 10 }}><div className="field"><label htmlFor="ai-year">Year</label><input id="ai-year" type="number" className="inp" style={{ background: '#fff' }} value={year} onChange={e => setYear(e.target.value)} /></div><div className="field"><label htmlFor="ai-genre">Genre</label><select id="ai-genre" className="inp" style={{ background: '#fff' }} value={genre} onChange={e => setGenre(e.target.value)}>{Object.entries(GENRES).filter(([g]) => g !== 'podcasts').map(([g, x]) => <option key={g} value={g}>{x.name}</option>)}</select></div></div>
        <div className="field"><label htmlFor="ai-cc">Country</label><select id="ai-cc" className="inp" style={{ background: '#fff' }} value={cc} onChange={e => setCc(e.target.value)}>{Object.keys(FLAG).map(c => <option key={c} value={c}>{FLAG[c]} {CNAME[c]}</option>)}</select></div></>}
    <div className="row"><button className="btn sm" onClick={save} disabled={busy}>{busy ? 'Adding…' : 'Add'}</button><button className="btn sm ghost" onClick={() => onDone(null)}>Cancel</button></div>
  </div>;
}

/* ---------------- forecasts ---------------- */
export function ForecastPanel({ id, closed, resolved, myP, crowdP }: { id: string; closed: boolean; resolved: 'yes' | 'no' | null; myP: number | null; crowdP: number | null }) {
  const { api, profile, requireSignIn, toast } = useMelo(); const router = useRouter();
  const [p, setP] = useState(myP ?? crowdP ?? 50); const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState<'yes' | 'no' | null>(null);
  async function lock() { if (!requireSignIn()) return; setBusy(true); try { await api.predict(id, p); toast(`Locked in at ${p}%`); router.refresh(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } }
  async function resolve(o: 'yes' | 'no' | null) { try { await api.resolve(id, o); toast(o ? 'Resolved. Ear scores updated.' : 'Reopened'); setConfirming(null); router.refresh(); } catch (e) { toast((e as Error).message); } }
  return <div className="stack">
    {resolved ? <p className="notice">Resolved <b>{resolved.toUpperCase()}</b>.{myP != null && ` You said ${myP}%.`}</p>
      : closed ? <p className="notice">Closed for new forecasts. Waiting for the result.</p>
      : <div className="card stack"><b>Your forecast: {p}%</b><input type="range" min={1} max={99} value={p} onChange={e => setP(Number(e.target.value))} aria-label="Probability" /><div className="row" style={{ justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--dim)' }}><span>Won&apos;t happen</span><span>Will happen</span></div><button className="btn block" onClick={lock} disabled={busy}>{myP != null ? 'Update forecast' : 'Lock in forecast'}</button></div>}
    {profile?.is_admin && (resolved ? <button className="btn ghost" onClick={() => resolve(null)}>Reopen this question</button>
      : <div className="card stack"><b>Resolve (admins)</b>{confirming ? <div className="row"><span>Mark as <b>{confirming.toUpperCase()}</b>? Everyone gets scored.</span><button className="btn sm" onClick={() => resolve(confirming)}>Confirm</button><button className="btn sm ghost" onClick={() => setConfirming(null)}>Cancel</button></div> : <div className="g2" style={{ gap: 10 }}><button className="btn" style={{ background: 'var(--good)' }} onClick={() => setConfirming('yes')}>It happened</button><button className="btn danger" onClick={() => setConfirming('no')}>It didn&apos;t</button></div>}</div>)}
  </div>;
}

/* ---------------- moments ---------------- */
export function Moments({ itemId, durMin, initial, names }: { itemId: string; durMin: number | null; initial: Moment[]; names: Record<string, { name: string; color: string; handle: string }> }) {
  const { api, requireSignIn, toast, user } = useMelo();
  const [list, setList] = useState(initial); const [sel, setSel] = useState<number | null>(null); const [ts, setTs] = useState('12:30'); const [text, setText] = useState('');
  const dur = (durMin ?? 0) * 60 || Math.max(3600, ...list.map(m => m.t_seconds + 60));
  const bins = 24, per = dur / bins; const counts = Array(bins).fill(0); list.forEach(m => counts[Math.min(bins - 1, Math.floor(m.t_seconds / per))]++); const mx = Math.max(1, ...counts);
  const shown = sel == null ? list : list.filter(m => Math.floor(m.t_seconds / per) === sel);
  async function add() {
    if (!requireSignIn()) return; const t = parseTimestamp(ts); if (t == null) { toast('Use a time like 12:30 or 1:02:05.'); return; } if (!text.trim()) return;
    try { await api.addMoment(itemId, t, text.trim().slice(0, LIMITS.moment)); setText(''); setList(await api.moments(itemId)); toast(`Moment pinned at ${mmss(t)}`); } catch (e) { toast((e as Error).message); }
  }
  return <div className="stack">
    <div className="card"><div className="row" style={{ justifyContent: 'space-between' }}><b>Where people reacted</b><span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{sel == null ? (list.length ? 'Tap a spike' : 'No moments yet') : <button style={{ color: 'var(--blue)' }} onClick={() => setSel(null)}>Show all</button>}</span></div>
      <div className="timeline">{counts.map((v, i) => <button key={i} className={sel === i ? 'on' : sel != null ? 'dim' : ''} style={{ height: `${Math.max(6, (v / mx) * 100)}%` }} onClick={() => { setSel(sel === i ? null : i); setTs(mmss(Math.round(i * per))); }} aria-label={mmss(Math.round(i * per))} />)}</div>
      <div className="tl-axis"><span>0:00</span><span>{mmss(dur / 2)}</span><span>{mmss(dur)}</span></div></div>
    <div className="comments">{shown.map(m => { const n = names[m.author]; return <div key={m.id} className="cmt"><Avatar name={n?.name ?? '?'} color={n?.color} /><div className="bubble"><div className="hd"><span className="ts">{mmss(m.t_seconds)}</span><b>{n?.name ?? 'Someone'}</b><small>{ago(m.created_at)}</small></div><p>{m.body}</p>{user?.id === m.author && <div className="ca"><button onClick={async () => { await api.deleteMoment(m.id); setList(list.filter(x => x.id !== m.id)); }}>Delete</button></div>}</div></div>; })}</div>
    <div className="card stack"><b>Add a moment</b><div className="row" style={{ flexWrap: 'nowrap' }}><input className="inp" style={{ width: 100, background: '#fff', textAlign: 'center' }} value={ts} onChange={e => setTs(e.target.value)} aria-label="Timestamp" /><input className="inp" style={{ background: '#fff' }} value={text} onChange={e => setText(e.target.value)} placeholder="What happened at this minute?" aria-label="Moment" maxLength={LIMITS.moment} /></div><div><button className="btn sm" onClick={add}>Post moment</button></div></div>
  </div>;
}

/* ---------------- story cards ---------------- */
/** Shares the 1080×1920 story image: the phone's share sheet when the browser supports files (Instagram shows up there), else opens it to save. */
export function StoryButton({ path, label = 'Share to story', dark }: { path: string; label?: string; dark?: boolean }) {
  const { toast } = useMelo(); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const blob = await (await fetch(path)).blob();
      const file = new File([blob], 'melo-story.png', { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'melo-story.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); toast('Story image saved'); }
    } catch (e) { if ((e as Error).name !== 'AbortError') toast('Could not make the story image.'); } finally { setBusy(false); }
  }
  return <button className={`btn ${dark ? 'dark' : 'ghost'} sm`} onClick={go} disabled={busy}><Icon name="share" size={16} /> {busy ? 'Making it…' : label}</button>;
}
