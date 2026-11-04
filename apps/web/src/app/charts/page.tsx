import type { Metadata } from 'next';
import Link from 'next/link';
import type { Artist, CatalogItem, ChartKind, ChartRow, ChartScope } from '@melo/core';
import { serverApi, safe } from '@/lib/server';
import { ArtistArt, ItemArt } from '@/components/ui';

export const metadata: Metadata = { title: 'Charts', description: 'What Melo listened to this week: albums, artists and podcasts, for everyone or just the people you follow.' };
type P = { searchParams: Promise<{ scope?: string; kind?: string }> };

function Move({ r }: { r: ChartRow }) {
  if (r.prev_rank == null) return <span className="mv new">NEW</span>;
  const d = r.prev_rank - r.rank;
  return d === 0 ? <span className="mv">–</span> : <span className={`mv ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>;
}

export default async function ChartsPage({ searchParams }: P) {
  const sp = await searchParams;
  const scope: ChartScope = sp.scope === 'friends' ? 'friends' : 'public';
  const kind: ChartKind = sp.kind === 'artists' || sp.kind === 'podcasts' ? sp.kind : 'albums';
  const api = await serverApi();
  const me = await safe(() => api.uid(), null);
  const rows = scope === 'friends' && !me ? [] : await safe(() => api.chart(scope, kind, 7, 50), []);
  const items: Record<string, CatalogItem> = kind === 'artists' ? {} : Object.fromEntries((await safe(() => api.items(rows.map(r => r.subject_id)), [])).map(i => [i.id, i]));
  const artists: Record<string, Artist> = kind === 'artists' ? Object.fromEntries((await safe(() => api.artists(rows.map(r => r.subject_id)), [])).map(a => [a.id, a])) : {};
  const q = (o: Record<string, string>) => '?' + new URLSearchParams({ scope, kind, ...o }).toString();
  return <>
    <section className="band"><div className="wrap stack" style={{ paddingTop: 40, paddingBottom: 72, gap: 16 }}>
      <span className="eyebrow">Charts</span>
      <h1 style={{ fontSize: 'clamp(32px,5vw,48px)' }}>This week on Melo</h1>
      <p className="muted" style={{ maxWidth: 620 }}>Ranked by how many people logged it in the last 7 days, then by rating. Arrows compare with the week before. Imported history doesn&apos;t count.</p>
      <div className="row">{([['public', 'Everyone'], ['friends', 'Friends']] as const).map(([v, l]) => <Link key={v} href={q({ scope: v })} className={`chip ${scope === v ? 'on' : ''}`}>{l}</Link>)}</div>
      <div className="row">{([['albums', 'Albums'], ['artists', 'Artists'], ['podcasts', 'Podcasts']] as const).map(([v, l]) => <Link key={v} href={q({ kind: v })} className={`chip ${kind === v ? 'on' : ''}`}>{l}</Link>)}</div>
    </div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 820 }}>
      {scope === 'friends' && !me ? <p className="muted"><Link href="/login?next=/charts?scope=friends" style={{ color: 'var(--blue)' }}>Sign in</Link> to see what the people you follow are listening to.</p>
        : !rows.length ? <p className="muted">{scope === 'friends' ? 'Nobody you follow has logged anything this week. Follow more people, or be the first.' : 'The chart fills up as people log what they listen to this week.'}</p>
        : <ol className="chart">{rows.map(r => {
          const it = items[r.subject_id]; const a = artists[r.subject_id];
          const href = kind === 'artists' ? `/artist/${r.subject_id}` : `/album/${r.subject_id}`;
          return <li key={r.subject_id}><Link href={href} className="chart-row">
            <span className="rk"><b className={r.rank === 1 ? 'top' : ''}>{r.rank}</b><Move r={r} /></span>
            {kind === 'artists' ? <ArtistArt id={r.subject_id} name={a?.name} art={a?.image_url ?? a?.artwork_url} size={56} /> : it ? <ItemArt item={it} size={56} /> : <span style={{ width: 56 }} />}
            <span className="m"><b>{kind === 'artists' ? a?.name ?? 'Artist' : it?.title ?? '…'}</b><small>{[kind === 'artists' ? '' : it?.artist_name, `${r.listeners} ${r.listeners === 1 ? 'listener' : 'listeners'}`, r.avg_rating != null ? `★ ${Number(r.avg_rating).toFixed(1)}` : ''].filter(Boolean).join(' · ')}</small></span>
          </Link></li>;
        })}</ol>}
    </div></div>
  </>;
}
