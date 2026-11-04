import { ImageResponse } from 'next/og';
import { flag, type CatalogItem, type Profile, type ProfileStats } from '@melo/core';
import { Avatar, BLUE, DIM, Fallback, INK, PAPER, Wordmark, clip, host, itemImage, ogFonts, read } from '@/lib/og';

export const alt = 'A profile on Melo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const opts = { ...size, fonts: await ogFonts() };
  const p = await read(api => api.profileByHandle(handle), null as Profile | null);
  if (!p) return new ImageResponse(<Fallback line="Find people who hear it the way you do." />, opts);
  const [stats, top] = await Promise.all([read(api => api.stats(p.id), null as ProfileStats | null), read(api => api.items(p.top4), [] as CatalogItem[])]);
  const top4 = p.top4.map(id => top.find(t => t.id === id)).filter((x): x is CatalogItem => !!x);
  const stat = (n: number | string | null | undefined, l: string) => <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: l === 'Ear' ? BLUE : PAPER }}>{n ?? 0}</div><div style={{ display: 'flex', fontSize: 22, color: DIM, fontWeight: 600 }}>{l}</div></div>;
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, color: PAPER, fontFamily: 'Urbanist', padding: 56, justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Avatar name={p.name} color={p.color} size={120} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, letterSpacing: -1.5 }}>{clip(p.name, 26)}</div>
          <div style={{ display: 'flex', fontSize: 28, color: DIM, fontWeight: 600 }}>@{p.handle} {flag(p.cc)}{p.bio ? ` · ${clip(p.bio, 50)}` : ''}</div>
        </div>
        <Wordmark size={40} />
      </div>
      <div style={{ display: 'flex', gap: 22 }}>{top4.map(it => <img key={it.id} src={itemImage(it, 300)} width={190} height={190} style={{ borderRadius: 18, objectFit: 'cover' }} />)}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 48 }}>{stat(stats?.logged, 'Logged')}{stat(stats?.posts, 'Posts')}{stat(stats?.followers, 'Followers')}{stat(stats?.ear != null ? Math.round(stats.ear) : '–', 'Ear')}</div>
        <div style={{ display: 'flex', fontSize: 24, color: DIM, fontWeight: 600 }}>{host}/u/{p.handle}</div>
      </div>
    </div>, opts);
}
