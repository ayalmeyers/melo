'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ago, type MeloNotification, type Profile } from '@melo/core';
import { useMelo } from '@/components/session';
import { Avatar, Icon } from '@/components/ui';

const VERB: Record<string, string> = { comment: 'commented on your post', reply: 'replied to you', follow: 'followed you', like: 'liked your post', laugh: 'laughed at your post' };
const href = (n: MeloNotification, who?: Profile) => n.forecast_id ? `/forecasts/${n.forecast_id}` : n.post_id ? `/p/${n.post_id}` : who ? `/u/${who.handle}` : '/feed';

export default function ActivityPage() {
  const { api, user, ready } = useMelo(); const router = useRouter();
  const [list, setList] = useState<MeloNotification[] | null>(null); const [people, setPeople] = useState<Record<string, Profile>>({});
  useEffect(() => { if (ready && !user) router.replace('/login?next=/activity'); }, [ready, user, router]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const ns = await api.notifications(80).catch(() => []);
      const ps = await api.profilesByIds([...new Set(ns.map(n => n.actor).filter((a): a is string => !!a))]).catch(() => []);
      setPeople(Object.fromEntries(ps.map(p => [p.id, p]))); setList(ns);
      if (ns.some(n => !n.read_at)) api.markNotificationsRead().catch(() => {});
    })();
  }, [api, user]);
  return <section className="wrap sec" style={{ maxWidth: 720 }}>
    <h1 style={{ fontSize: 34, marginBottom: 16 }}>Notifications</h1>
    <div className="card">
      {list && !list.length && <p className="muted">Replies, likes, new followers and resolved forecasts show up here.</p>}
      {(list ?? []).map(n => { const who = n.actor ? people[n.actor] : undefined; return <Link key={n.id} href={href(n, who)} className="note-row">
        {who ? <Avatar name={who.name} color={who.color} size="lg" /> : <span className="ic"><Icon name="sparkle" size={18} /></span>}
        <span style={{ flex: 1, minWidth: 0 }}>{who ? <><b>{who.name}</b> {VERB[n.kind]}</> : <b>A forecast you made resolved</b>}{n.body && <span className="muted">: {n.body}</span>}<br /><small className="muted">{ago(n.created_at)}</small></span>
        {!n.read_at && <span className="dot" aria-label="New" />}
      </Link>; })}
    </div>
  </section>;
}
