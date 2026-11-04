import { ImageResponse } from 'next/og';
import { genreName, type CatalogItem, type ItemRating } from '@melo/core';
import { BLUE, DIM, Fallback, INK, MIST, PAPER, StarsRow, TEXT, Wordmark, clip, host, itemImage, ogFonts, read } from '@/lib/og';

export async function loadAlbum(id: string) {
  const [item, ratings] = await Promise.all([read(api => api.item(id), null as CatalogItem | null), read(api => api.ratings([id]), {} as Record<string, ItemRating>)]);
  return { item, rating: ratings[id] ?? null };
}
const kindLabel = (it: CatalogItem) => (it.type === 'show' ? 'Podcast' : it.type === 'episode' ? 'Episode' : 'Album');

export async function albumPreview(id: string, data?: Awaited<ReturnType<typeof loadAlbum>>) {
  const { item: it, rating } = data ?? await loadAlbum(id);
  const opts = { width: 1200, height: 630, fonts: await ogFonts() };
  if (!it) return new ImageResponse(<Fallback line="Rate, review and argue about music." />, opts);
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 56, gap: 56 }}>
      <img src={itemImage(it)} width={518} height={518} style={{ borderRadius: 30, objectFit: 'cover' }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <Wordmark size={40} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: BLUE, letterSpacing: 2 }}>{kindLabel(it).toUpperCase()}</div>
          <div style={{ display: 'flex', fontSize: it.title.length > 28 ? 50 : 64, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1.5 }}>{clip(it.title, 70)}</div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: '#c9cdd6' }}>{clip([it.artist_name, it.year, genreName(it.genre)].filter(Boolean).join(' · '), 48)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {rating ? <><StarsRow r10={Math.round(rating.avg_stars * 2)} size={38} /><div style={{ display: 'flex', fontSize: 26, color: DIM, fontWeight: 600 }}>{rating.avg_stars.toFixed(1)} from {rating.n} on Melo</div></>
            : <div style={{ display: 'flex', fontSize: 26, color: DIM, fontWeight: 600 }}>Be the first to rate it on {host}</div>}
        </div>
      </div>
    </div>, opts);
}

/** Story card: "I'm listening to…" with the cover big. */
export async function albumStory(id: string, data?: Awaited<ReturnType<typeof loadAlbum>>) {
  const { item: it, rating } = data ?? await loadAlbum(id);
  const opts = { width: 1080, height: 1920, fonts: await ogFonts(), headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' } };
  if (!it) return new ImageResponse(<Fallback line="Rate, review and argue about music." />, opts);
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, fontFamily: 'Urbanist', alignItems: 'center', padding: '120px 80px 90px' }}>
      <Wordmark size={56} />
      <div style={{ display: 'flex', fontSize: 40, color: DIM, fontWeight: 600, marginTop: 90 }}>{it.type === 'album' ? 'Now spinning' : 'Now listening'}</div>
      <img src={itemImage(it, 1000)} width={860} height={860} style={{ borderRadius: 44, objectFit: 'cover', marginTop: 40 }} />
      <div style={{ display: 'flex', color: PAPER, fontSize: it.title.length > 26 ? 64 : 80, fontWeight: 800, letterSpacing: -2, textAlign: 'center', lineHeight: 1.05, marginTop: 56, maxWidth: 920 }}>{clip(it.title, 60)}</div>
      <div style={{ display: 'flex', color: '#c9cdd6', fontSize: 42, fontWeight: 600, marginTop: 18 }}>{clip(it.artist_name, 40)}</div>
      <div style={{ display: 'flex', flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: MIST, borderRadius: 30, padding: '28px 36px', color: TEXT }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 600 }}>{rating ? `★ ${rating.avg_stars.toFixed(1)} from ${rating.n} on Melo` : 'Rate it with me on Melo'}</div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: BLUE }}>{host}</div>
      </div>
    </div>, opts);
}
