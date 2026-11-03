import type { Metadata } from 'next';
import Link from 'next/link';
import { serverApi, safe } from '@/lib/server';
import { ComposeButton } from '@/components/interactive';
import { Avatar, Gauge } from '@/components/ui';

export const metadata: Metadata = { title: 'Forecasts', description: 'The Melo crowd puts a number on what happens next in music.' };
type P = { searchParams: Promise<{ tab?: string }> };

export default async function Forecasts({ searchParams }: P) {
  const { tab: tp } = await searchParams; const tab = tp === 'resolved' || tp === 'ears' ? tp : 'open';
  const api = await serverApi();
  const [list, board] = await Promise.all([safe(() => api.forecasts(tab === 'resolved' ? 'resolved' : 'open'), []), tab === 'ears' ? safe(() => api.earBoard(), []) : Promise.resolve([])]);
  const people = tab === 'ears' ? await safe(() => api.profilesByIds(board.map(b => b.user_id)), []) : [];
  const pmap = Object.fromEntries(people.map(p => [p.id, p]));
  return <>
    <section className="band"><div className="wrap" style={{ paddingTop: 40, paddingBottom: 72 }}><span className="eyebrow">Forecasts</span><h1 style={{ fontSize: 'clamp(32px,5vw,48px)', margin: '8px 0 10px' }}>The crowd&apos;s number on what happens next</h1>
      <p className="muted" style={{ maxWidth: '60ch', fontSize: 17 }}>Give a probability. Melo averages everyone, weighting people by how often they&apos;ve been right. No money changes hands; your record shows as an Ear score from 0 to 100, where 50 is coin-flip accuracy.</p>
      <div className="row" style={{ marginTop: 20 }}>{[['open', 'Open'], ['resolved', 'Resolved'], ['ears', 'Early Ears']].map(([v, l]) => <Link key={v} href={`?tab=${v}`} className={`chip ${tab === v ? 'on' : ''}`}>{l}</Link>)}<ComposeButton kind="forecast" label="Ask a question" /></div></div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 820 }}>
      {tab === 'ears' ? (board.length ? board.map((b, i) => { const p = pmap[b.user_id]; return p ? <Link key={b.user_id} href={`/u/${p.handle}`} className="list-row"><b style={{ width: 24, color: '#b8bcc6' }}>{i + 1}</b><Avatar name={p.name} color={p.color} /><span className="m"><b>{p.name}</b><small>{b.resolved} resolved</small></span><span className="ear">Ear {b.ear}</span></Link> : null; }) : <p className="notice">Ear scores appear once questions resolve.</p>)
        : <div className="stack">{list.map(f => <Link key={f.id} href={`/forecasts/${f.id}`} className="fc"><div className="row" style={{ flexWrap: 'nowrap' }}><Gauge p={f.c?.crowd_p ?? null} /><div style={{ minWidth: 0 }}><p className="q">{f.question}</p><div className="meta">{f.c?.outcome ? <span className={`status ${f.c.outcome}`}>Resolved {f.c.outcome}</span> : <span className="status">Closes {new Date(f.closes_on + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}<span>{f.c?.forecasters ?? 0} forecasters</span></div></div></div></Link>)}{!list.length && <p className="empty">{tab === 'open' ? 'No open questions. Ask one.' : 'Nothing resolved yet.'}</p>}</div>}
    </div></div>
  </>;
}
