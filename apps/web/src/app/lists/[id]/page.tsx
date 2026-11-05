import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi, safe } from '@/lib/server';
import { ListEditor } from '@/components/lists';
import { Avatar, ItemArt } from '@/components/ui';

type P = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params; const api = await serverApi(); const d = await safe(() => api.list(id), null);
  return d ? { title: d.list.title, description: d.list.description || `A list by ${d.list.owner_name} on Melo.` } : { title: 'Not found' };
}

export default async function ListPage({ params }: P) {
  const { id } = await params; const api = await serverApi();
  const d = await safe(() => api.list(id), null); if (!d) notFound();
  const { list, entries } = d;
  const items = Object.fromEntries((await safe(() => api.items(entries.map(e => e.item_id)), [])).map(i => [i.id, i]));
  return <>
    <section className="band"><div className="wrap stack" style={{ paddingTop: 40, paddingBottom: 72, gap: 14, maxWidth: 820 }}>
      <span className="eyebrow">{list.ranked ? 'Ranked list' : 'List'}</span>
      <h1 style={{ fontSize: 'clamp(30px,5vw,44px)' }}>{list.title}</h1>
      {list.description && <p style={{ color: 'var(--dim)', fontSize: 17, maxWidth: '60ch', whiteSpace: 'pre-wrap' }}>{list.description}</p>}
      <Link href={`/u/${list.owner_handle}`} className="row" style={{ color: 'var(--dim)', fontWeight: 600 }}><Avatar name={list.owner_name} color={list.owner_color} size="xs" /> {list.owner_name} · {list.item_count} records</Link>
    </div></section>
    <div className="sheet"><div className="wrap sec two" style={{ maxWidth: 1100 }}>
      <ol className="chart">{entries.map((e, i) => { const it = items[e.item_id]; if (!it) return null; return <li key={e.item_id}><Link href={`/album/${it.id}`} className="chart-row">
        {list.ranked && <span className="rk"><b className={i === 0 ? 'top' : ''}>{i + 1}</b></span>}
        <ItemArt item={it} size={64} />
        <span className="m"><b>{it.title}</b><small>{it.artist_name}{it.year ? ` · ${it.year}` : ''}</small>{e.note && <span style={{ whiteSpace: 'normal', fontSize: 15, marginTop: 4 }}>{e.note}</span>}</span>
      </Link></li>; })}{!entries.length && <p className="muted">Nothing on this list yet.</p>}</ol>
      <aside className="side"><ListEditor list={list} entries={entries} items={items} /></aside>
    </div></div>
  </>;
}
