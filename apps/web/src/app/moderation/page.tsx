'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ago, type QueuedReport, type ReportAction } from '@melo/core';
import { useMelo } from '@/components/session';

/** Admin report queue. Apple expects reports on user content to be handled within 24 hours. */
export default function ModerationPage() {
  const { api, profile, ready, toast } = useMelo();
  const [status, setStatus] = useState<'open' | 'actioned' | 'dismissed'>('open');
  const [list, setList] = useState<QueuedReport[] | null>(null);
  const load = useCallback(() => { if (profile?.is_admin) api.reportQueue(status).then(setList).catch(e => toast((e as Error).message)); }, [api, profile?.is_admin, status, toast]);
  useEffect(load, [load]);
  if (ready && !profile?.is_admin) return <section className="wrap sec"><h1>Moderation</h1><p className="muted">This page is for admins.</p></section>;
  async function act(r: QueuedReport, a: ReportAction) {
    if (a === 'ban' && !confirm(`Ban @${r.author_handle}? This removes the content and stops them posting.`)) return;
    try { await api.moderate(r.id, a); toast(a === 'dismiss' ? 'Dismissed' : a === 'unban' ? 'Unbanned' : 'Done'); load(); } catch (e) { toast((e as Error).message); }
  }
  return <section className="wrap sec stack" style={{ maxWidth: 820 }}>
    <h1 style={{ fontSize: 34 }}>Moderation</h1>
    <div className="seg">{(['open', 'actioned', 'dismissed'] as const).map(s => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
    {list && !list.length && <p className="muted">{status === 'open' ? 'Nothing to review.' : 'Nothing here.'}</p>}
    {(list ?? []).map(r => <div key={r.id} className="mod-card">
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="k">{r.target_type}{r.reports_on_target > 1 ? ` · ${r.reports_on_target} reports` : ''}</span><small className="muted">{ago(r.created_at)}</small></div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{r.content ?? <span className="muted">Already deleted.</span>}</p>
      <small className="muted">by {r.author_handle ? <Link href={`/u/${r.author_handle}`}>@{r.author_handle}</Link> : 'unknown'}{r.author_banned ? ' (banned)' : ''} · reported by {r.reporter_handle ? `@${r.reporter_handle}` : 'someone'}{r.reason ? ` · “${r.reason}”` : ''}{r.link ? <> · <Link href={r.link}>open</Link></> : null}</small>
      {status === 'open' && <div className="actions">
        {r.target_type !== 'profile' && <button className="btn sm danger" onClick={() => act(r, 'remove')}>Remove</button>}
        {r.author_banned ? <button className="btn sm ghost" onClick={() => act(r, 'unban')}>Unban</button> : <button className="btn sm dark" onClick={() => act(r, 'ban')}>Ban author</button>}
        <button className="btn sm ghost" onClick={() => act(r, 'dismiss')}>Dismiss</button>
      </div>}
    </div>)}
  </section>;
}
