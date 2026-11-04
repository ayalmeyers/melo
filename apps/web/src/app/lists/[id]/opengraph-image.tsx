import { ImageResponse } from 'next/og';
import { BLUE, DIM, Fallback, INK, PAPER, Wordmark, clip, host, itemImage, ogFonts, read } from '@/lib/og';

export const alt = 'A list on Melo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opts = { ...size, fonts: await ogFonts() };
  const d = await read(api => api.list(id), null);
  if (!d) return new ImageResponse(<Fallback line="Lists of the records that made you." />, opts);
  const { list } = d;
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: BLUE, letterSpacing: 2 }}>{list.ranked ? 'RANKED LIST' : 'LIST'}</div><Wordmark size={40} /></div>
      <div style={{ display: 'flex' }}>{list.preview.map((p, i) => <img key={p.id} src={itemImage(p, 400)} width={250} height={250} style={{ borderRadius: 22, objectFit: 'cover', marginLeft: i ? -40 : 0, border: `6px solid ${INK}` }} />)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', fontSize: list.title.length > 40 ? 48 : 60, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>{clip(list.title, 70)}</div>
        <div style={{ display: 'flex', fontSize: 26, color: DIM, fontWeight: 600 }}>by {list.owner_name} · {list.item_count} records · {host}</div>
      </div>
    </div>, opts);
}
