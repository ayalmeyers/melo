import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ARTISTS, GENRES } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { Comments, ForecastPanel } from '@/components/interactive';
import { Avatar, Gauge } from '@/components/ui';

type P = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> { const { id } = await params; const api = await serverApi(); const f = await safe(() => api.forecast(id), null); return f ? { title: f.question, description: `The Melo crowd says ${f.c?.crowd_p ?? '–'}%.` } : { title: 'Not found' }; }

export default async function ForecastPage({ params }: P) {
  const { id } = await params; const api = await serverApi();
  const f = await safe(() => api.forecast(id), null); if (!f) notFound();
  const [me, comments, people] = await Promise.all([safe(() => api.uid(), null), safe(() => api.comments({ forecast: id }), []), safe(() => api.profilesByIds(f.preds.map(p => p.user_id)), [])]);
  const pmap = Object.fromEntries(people.map(p => [p.id, p]));
  const myP = f.preds.find(p => p.user_id === me)?.p ?? null;
  const closed = new Date(f.closes_on + 'T23:59:59') < new Date();
  const dist = f.c?.distribution ?? Array(10).fill(0); const mx = Math.max(1, ...dist);
  const tgt = f.target_type === 'artist' && f.target_id ? <Link className="tchip" href={`/artist/${f.target_id}`}>{ARTISTS[f.target_id]?.name}</Link> : f.target_type === 'genre' && f.target_id ? <Link className="tchip" href={`/genre/${f.target_id}`}>#{GENRES[f.target_id]?.name}</Link> : f.target_type === 'item' && f.target_id ? <Link className="tchip" href={`/album/${f.target_id}`}>Open the album</Link> : null;
  return <section className="wrap sec"><div className="two">
    <div className="stack" style={{ gap: 22, minWidth: 0 }}>
      <Link href="/forecasts" style={{ color: 'var(--blue)', fontWeight: 600 }}>← All forecasts</Link>
      <div className="fc"><div className="row" style={{ flexWrap: 'nowrap' }}><Gauge p={f.c?.crowd_p ?? null} /><div style={{ minWidth: 0 }}><h1 className="q" style={{ fontSize: 24 }}>{f.question}</h1><div className="meta">{f.c?.outcome ? <span className={`status ${f.c.outcome}`}>Resolved {f.c.outcome}</span> : <span className="status">{closed ? 'Awaiting result' : 'Closes ' + new Date(f.closes_on + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}<span>{f.c?.forecasters ?? 0} forecasters</span></div></div></div>{tgt && <div>{tgt}</div>}</div>
      {f.detail && <p style={{ fontSize: 16.5, color: '#3c4250' }}>{f.detail}</p>}
      <div className="card"><b>Where people land</b><div className="dist" style={{ marginTop: 10 }}>{dist.map((v, i) => <i key={i} className={f.c?.crowd_p != null && Math.floor(Math.min(99, f.c.crowd_p) / 10) === i ? 'c' : ''} style={{ height: `${(v / mx) * 100}%` }} />)}</div><div className="hist-l"><span>0%</span><span>50%</span><span>100%</span></div></div>
      <ForecastPanel id={id} closed={closed} resolved={f.c?.outcome ?? null} myP={myP} crowdP={f.c?.crowd_p ?? null} />
      <Comments on={{ forecast: id }} initial={comments} />
    </div>
    <aside className="side"><div className="card"><h3 style={{ marginBottom: 8 }}>Forecasters</h3>{f.preds.map(p => { const pr = pmap[p.user_id]; return pr ? <Link key={p.user_id} className="list-row" href={`/u/${pr.handle}`}><Avatar name={pr.name} color={pr.color} /><span className="m"><b>{pr.name}</b></span><b>{p.p}%</b></Link> : null; })}{!f.preds.length && <p className="muted">Be the first.</p>}</div></aside>
  </div></section>;
}
