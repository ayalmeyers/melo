import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverApi, safe } from '@/lib/server';
import { Comments, ItemRow, PostList } from '@/components/interactive';

type P = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { id } = await params; const api = await serverApi(); const p = await safe(() => api.post(id), null);
  if (!p) return { title: 'Not found' };
  const text = (p.title || p.body).slice(0, 140);
  return { title: `${p.author_name} on Melo`, description: text, openGraph: { title: `${p.author_name} on Melo`, description: text } };
}

export default async function PostPage({ params }: P) {
  const { id } = await params; const api = await serverApi();
  const p = await safe(() => api.post(id), null); if (!p) notFound();
  const [comments, it] = await Promise.all([safe(() => api.comments({ post: id }), []), p.target_type === 'item' && p.target_id ? safe(() => api.item(p.target_id!), null) : Promise.resolve(null)]);
  return <section className="wrap sec"><div className="two">
    <div className="stack" style={{ gap: 24, minWidth: 0 }}><PostList posts={[p]} items={it ? { [it.id]: it } : {}} full /><Comments on={{ post: id }} initial={comments} /></div>
    <aside className="side">{it && <div className="card"><ItemRow it={it} size={72} /></div>}</aside>
  </div></section>;
}
