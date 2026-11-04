import { ImageResponse } from 'next/og';
import { artistName, genreName, type CatalogItem, type FeedPost } from '@melo/core';
import { Avatar, BLUE, DIM, Fallback, INK, INK2, MIST, PAPER, StarsRow, TEXT, Wordmark, artistImage, clip, host, itemImage, ogFonts, read } from '@/lib/og';

export async function loadPost(id: string) {
  const post = await read(api => api.post(id), null as FeedPost | null);
  const item = post?.target_type === 'item' && post.target_id ? await read(api => api.item(post.target_id!), null as CatalogItem | null) : null;
  const artist = post?.target_type === 'artist' && post.target_id ? await read(api => api.artist(post.target_id!), null) : null;
  return { post, item, artist };
}
const KIND = { review: 'Review', take: 'Hot take', thread: 'Thread' } as const;
const about = (p: FeedPost, item: CatalogItem | null, artist: { name: string } | null) =>
  item ? `${item.title} · ${item.artist_name}` : p.target_type === 'artist' ? artist?.name ?? artistName(p.target_id ?? '') : p.target_type === 'genre' ? `#${genreName(p.target_id)}` : '';

/** 1200×630 link preview for a post. */
export async function postPreview(id: string, data?: Awaited<ReturnType<typeof loadPost>>) {
  const { post: p, item, artist } = data ?? await loadPost(id);
  const opts = { width: 1200, height: 630, fonts: await ogFonts() };
  if (!p) return new ImageResponse(<Fallback line="This post isn't here anymore." />, opts);
  const art = item ? itemImage(item) : p.target_type === 'artist' && p.target_id ? artistImage(p.target_id, artist?.name ?? '', artist?.artwork_url) : null;
  const text = (p.title ? p.title + '. ' : '') + p.body;
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 56, gap: 52 }}>
      {art && <img src={art} width={470} height={470} style={{ borderRadius: p.target_type === 'artist' ? 470 : 28, objectFit: 'cover', alignSelf: 'center' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Avatar name={p.author_name} color={p.author_color} size={60} />
          <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>{p.author_name}</div><div style={{ display: 'flex', fontSize: 24, color: DIM, fontWeight: 600 }}>@{p.author_handle} · {KIND[p.kind]}</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {p.kind === 'review' && p.rating != null && <StarsRow r10={p.rating} size={40} />}
          <div style={{ display: 'flex', fontSize: p.spoiler ? 34 : art ? 40 : 54, fontWeight: 800, lineHeight: 1.18, letterSpacing: -0.8 }}>{p.spoiler ? 'Contains spoilers. Open it on Melo.' : clip(text, art ? 170 : 220)}</div>
          {about(p, item, artist) && <div style={{ display: 'flex', fontSize: 26, color: '#c9cdd6', fontWeight: 600 }}>{clip(about(p, item, artist), 60)}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Wordmark size={40} /><div style={{ display: 'flex', fontSize: 22, color: DIM, fontWeight: 600 }}>{host}</div></div>
      </div>
    </div>, opts);
}

/** 1080×1920 story card for Instagram and other stories. */
export async function postStory(id: string, data?: Awaited<ReturnType<typeof loadPost>>) {
  const { post: p, item, artist } = data ?? await loadPost(id);
  const opts = { width: 1080, height: 1920, fonts: await ogFonts(), headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' } };
  if (!p) return new ImageResponse(<Fallback line="This post isn't here anymore." />, opts);
  const art = item ? itemImage(item, 1000) : p.target_type === 'artist' && p.target_id ? artistImage(p.target_id, artist?.name ?? '', artist?.artwork_url) : null;
  const text = (p.title ? p.title + '. ' : '') + p.body;
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, fontFamily: 'Urbanist' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '110px 80px 90px', gap: 40 }}>
        <Wordmark size={56} />
        {art ? <img src={art} width={760} height={760} style={{ borderRadius: p.target_type === 'artist' ? 760 : 40, objectFit: 'cover' }} />
          : <div style={{ display: 'flex', width: 760, height: 380, borderRadius: 40, background: INK2, alignItems: 'center', justifyContent: 'center', color: BLUE, fontSize: 220, fontWeight: 800 }}>“</div>}
        {about(p, item, artist) && <div style={{ display: 'flex', color: PAPER, fontSize: 44, fontWeight: 800, textAlign: 'center', maxWidth: 900, lineHeight: 1.1 }}>{clip(about(p, item, artist), 60)}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: PAPER, borderRadius: '64px 64px 0 0', padding: '64px 80px 80px', gap: 34, color: TEXT }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Avatar name={p.author_name} color={p.author_color} size={84} />
          <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>{p.author_name}</div><div style={{ display: 'flex', fontSize: 30, color: DIM, fontWeight: 600 }}>@{p.author_handle} · {KIND[p.kind]}</div></div>
        </div>
        {p.kind === 'review' && p.rating != null && <StarsRow r10={p.rating} size={64} />}
        <div style={{ display: 'flex', fontSize: 50, fontWeight: 800, lineHeight: 1.2, letterSpacing: -1 }}>{p.spoiler ? 'Contains spoilers. Read it on Melo.' : clip(text, 165)}</div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: MIST, borderRadius: 28, padding: '26px 34px' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: TEXT }}>Agree? Argue with me on Melo</div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: BLUE }}>{host}</div>
        </div>
      </div>
    </div>, opts);
}
