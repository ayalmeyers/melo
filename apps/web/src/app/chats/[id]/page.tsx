'use client';
import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GENRES, LIMITS, type Message, type Profile } from '@melo/core';
import { useMelo } from '@/components/session';
import { Avatar, Icon } from '@/components/ui';
import { useArtist } from '@/components/interactive';

function Shared({ m }: { m: Message }) {
  const artist = useArtist(m.share_type === 'artist' ? m.share_id : null);
  const href = m.share_type === 'post' ? `/p/${m.share_id}` : m.share_type === 'forecast' ? `/forecasts/${m.share_id}` : m.share_type === 'artist' ? `/artist/${m.share_id}` : m.share_type === 'genre' ? `/genre/${m.share_id}` : m.share_type === 'item' ? `/album/${m.share_id}` : '#';
  const label = m.share_type === 'artist' ? artist?.name ?? 'Artist' : m.share_type === 'genre' ? '#' + GENRES[m.share_id!]?.name : 'Open';
  return <Link href={href} className="shared"><span className="k">Shared {m.share_type}</span><b>{label}</b></Link>;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, user, ready, toast } = useMelo(); const router = useRouter();
  const [msgs, setMsgs] = useState<Message[]>([]); const [people, setPeople] = useState<Record<string, Profile>>({}); const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ready && !user) router.replace('/login?next=/chats/' + id); }, [ready, user, router, id]);
  useEffect(() => {
    if (!user) return;
    let off = () => {};
    (async () => {
      const cs = await api.chats(); const c = cs.find(x => x.id === id); if (!c) { toast('That chat is not available.'); router.push('/chats'); return; }
      const ps = await api.profilesByIds(c.members.map(m => m.user_id)); const pm = Object.fromEntries(ps.map(p => [p.id, p])); setPeople(pm);
      setTitle(c.name || c.members.filter(m => m.user_id !== user.id).map(m => pm[m.user_id]?.name).filter(Boolean).join(', '));
      setMsgs(await api.messages(id)); api.markRead(id).catch(() => {});
      off = api.onMessages(id, m => { setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]); api.markRead(id).catch(() => {}); });
    })().catch(e => toast((e as Error).message));
    return () => off();
  }, [api, user, id, router, toast]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  async function send() { const t = body.trim(); if (!t) return; setBody(''); try { await api.send(id, { body: t.slice(0, LIMITS.message) }); setMsgs(await api.messages(id)); } catch (e) { toast((e as Error).message); setBody(t); } }
  return <div className="wrap chat-wrap" style={{ maxWidth: 760 }}>
    <div className="row" style={{ paddingBlock: 14, borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}><Link href="/chats" aria-label="Back"><Icon name="back" /></Link><b style={{ fontSize: 18, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Chat'}</b></div>
    <div className="msgs">{msgs.map((m, i) => { const me = m.author === user?.id; const p = people[m.author]; const showName = !me && msgs[i - 1]?.author !== m.author;
      return <div key={m.id} className={`msg ${me ? 'me' : ''}`}>{!me && <Avatar name={p?.name ?? '?'} color={p?.color} size="xs" />}<div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: me ? 'flex-end' : 'flex-start', minWidth: 0 }}>{showName && <span className="nm">{p?.name}</span>}{m.share_type ? <Shared m={m} /> : <div className="bub">{m.body}</div>}</div></div>; })}
      {!msgs.length && <p className="empty">Say something.</p>}<div ref={end} /></div>
    <div className="composer"><textarea className="inp" value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message" aria-label="Message" maxLength={LIMITS.message} /><button className="btn" onClick={send} aria-label="Send"><Icon name="send" /></button></div>
  </div>;
}
