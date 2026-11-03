'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ago, type Chat, type ChatMember, type Profile } from '@melo/core';
import { useMelo } from '@/components/session';
import { Avatar, Icon } from '@/components/ui';

export default function Chats() {
  const { api, user, ready, toast } = useMelo(); const router = useRouter();
  const [chats, setChats] = useState<(Chat & { members: ChatMember[] })[] | null>(null); const [people, setPeople] = useState<Record<string, Profile>>({});
  const [creating, setCreating] = useState(false); const [q, setQ] = useState(''); const [found, setFound] = useState<Profile[]>([]); const [picked, setPicked] = useState<Profile[]>([]); const [name, setName] = useState('');
  useEffect(() => { if (ready && !user) router.replace('/login?next=/chats'); }, [ready, user, router]);
  useEffect(() => { if (!user) return; api.chats().then(async cs => { setChats(cs); const ids = [...new Set(cs.flatMap(c => c.members.map(m => m.user_id)))]; const ps = await api.profilesByIds(ids); setPeople(Object.fromEntries(ps.map(p => [p.id, p]))); }).catch(() => setChats([])); }, [api, user]);
  useEffect(() => { const t = setTimeout(() => { if (q.trim()) api.searchPeople(q.replace(/[%,()]/g, '')).then(r => setFound(r.filter(p => p.id !== user?.id))).catch(() => {}); else setFound([]); }, 200); return () => clearTimeout(t); }, [api, q, user]);
  async function create() { try { const id = await api.createChat(name.trim(), picked.map(p => p.id)); router.push(`/chats/${id}`); } catch (e) { toast((e as Error).message); } }
  return <section className="wrap sec" style={{ maxWidth: 720 }}><div className="stack">
    <div className="row" style={{ justifyContent: 'space-between' }}><h1 style={{ fontSize: 36 }}>Chats</h1><button className="btn sm" onClick={() => setCreating(!creating)}><Icon name="plus" size={18} /> New group</button></div>
    {creating && <div className="card stack"><div className="field"><label htmlFor="g-name">Group name</label><input id="g-name" className="inp" style={{ background: '#fff' }} value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder="Friday listening club" /></div>
      <div className="field"><label htmlFor="g-q">Add people</label><input id="g-q" className="inp" style={{ background: '#fff' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or username" /></div>
      {found.map(p => <button key={p.id} className="list-row" style={{ textAlign: 'left' }} onClick={() => { if (!picked.some(x => x.id === p.id)) setPicked([...picked, p]); setQ(''); }}><Avatar name={p.name} color={p.color} /><span className="m"><b>{p.name}</b><small>@{p.handle}</small></span><Icon name="plus" /></button>)}
      {picked.length > 0 && <div className="row">{picked.map(p => <button key={p.id} className="chip light" onClick={() => setPicked(picked.filter(x => x.id !== p.id))}>{p.name} ✕</button>)}</div>}
      <div><button className="btn sm" disabled={!picked.length} onClick={create}>Create group</button></div></div>}
    {chats === null ? <p className="empty">Loading…</p> : chats.length ? chats.map(c => { const others = c.members.filter(m => m.user_id !== user?.id).map(m => people[m.user_id]).filter(Boolean); const mine = c.members.find(m => m.user_id === user?.id); const unread = c.last_message_at && c.last_message_by !== user?.id && mine && new Date(c.last_message_at) > new Date(mine.last_read_at);
      return <Link key={c.id} href={`/chats/${c.id}`} className="list-row"><Avatar name={others[0]?.name ?? c.name ?? '?'} color={others[0]?.color} size="lg" /><span className="m"><b>{c.name || others.map(o => o.name).join(', ') || 'Chat'}</b><small>{c.last_message_preview ?? 'No messages yet'}</small></span><small className="muted">{c.last_message_at ? ago(c.last_message_at) : ''}</small>{unread && <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--blue)' }} aria-label="Unread" />}</Link>; })
      : <p className="empty">No chats yet. Start a group or message someone from their profile.</p>}
  </div></section>;
}
