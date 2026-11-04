import { ImageResponse } from 'next/og';
import { ARTISTS } from '@melo/core';
import { BLUE, DIM, Fallback, INK, PAPER, Wordmark, artistImage, clip, host, ogFonts, read } from '@/lib/og';

export const alt = 'An artist board on Melo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opts = { ...size, fonts: await ogFonts() };
  const a = await read(api => api.artist(id), null) ?? (ARTISTS[id] ? { id, name: ARTISTS[id].name, artwork_url: null } : null);
  if (!a) return new ImageResponse(<Fallback line="Every artist gets a board." />, opts);
  const followers = await read(api => api.followCount('artist', id), 0);
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 56, gap: 56, alignItems: 'center' }}>
      <img src={artistImage(id, a.name, a.artwork_url)} width={460} height={460} style={{ borderRadius: 460, objectFit: 'cover' }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: BLUE, letterSpacing: 2 }}>ARTIST BOARD</div>
        <div style={{ display: 'flex', fontSize: a.name.length > 18 ? 64 : 84, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{clip(a.name, 40)}</div>
        <div style={{ display: 'flex', fontSize: 30, color: DIM, fontWeight: 600 }}>{followers} following · reviews, threads and a wiki</div>
        <div style={{ display: 'flex', marginTop: 30, alignItems: 'center', gap: 24 }}><Wordmark size={40} /><div style={{ display: 'flex', fontSize: 24, color: DIM, fontWeight: 600 }}>{host}</div></div>
      </div>
    </div>, opts);
}
