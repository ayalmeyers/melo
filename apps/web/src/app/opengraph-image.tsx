import { ImageResponse } from 'next/og';
import { BLUE, DIM, INK, PAPER, Wordmark, host, ogFonts } from '@/lib/og';

export const alt = 'Melo: rate, review and argue about music and podcasts';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 72, justifyContent: 'space-between' }}>
      <Wordmark size={72} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>What the world</div>
        <div style={{ display: 'flex', fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>is listening to<span style={{ color: BLUE }}>.</span></div>
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: DIM, fontWeight: 600 }}>Rate, review and argue about music and podcasts · {host}</div>
    </div>, { ...size, fonts: await ogFonts() });
}
