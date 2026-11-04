import { ImageResponse } from 'next/og';
import { BLUE, DIM, Fallback, INK, INK2, PAPER, Wordmark, clip, host, ogFonts, read } from '@/lib/og';

export const alt = 'A forecast on Melo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opts = { ...size, fonts: await ogFonts() };
  const f = await read(api => api.forecast(id), null);
  if (!f) return new ImageResponse(<Fallback line="Call what happens next in music." />, opts);
  const p = f.c?.crowd_p ?? null; const out = f.c?.outcome;
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: BLUE, letterSpacing: 2 }}>FORECAST</div><Wordmark size={40} /></div>
      <div style={{ display: 'flex', fontSize: f.question.length > 90 ? 50 : 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>{clip(f.question, 140)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <div style={{ display: 'flex', fontSize: 110, fontWeight: 800, color: out ? (out === 'yes' ? '#2bb673' : '#e5484d') : BLUE, letterSpacing: -3 }}>{p == null ? '—' : `${p}%`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
          <div style={{ display: 'flex', height: 22, borderRadius: 11, background: INK2, overflow: 'hidden' }}><div style={{ display: 'flex', width: `${p ?? 0}%`, background: BLUE }} /></div>
          <div style={{ display: 'flex', fontSize: 26, color: DIM, fontWeight: 600 }}>{out ? `Resolved ${out.toUpperCase()}` : `The crowd's call, weighted by who's been right · ${f.c?.forecasters ?? 0} forecasters`}</div>
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 24, color: DIM, fontWeight: 600 }}>Make your call at {host}</div>
    </div>, opts);
}
