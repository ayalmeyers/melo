import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { appleArt, coverSvg, createApi, hash, itemCover, artistCover, type CatalogItem, type MeloApi } from '@melo/core';
import { SITE_URL, SUPABASE_KEY, SUPABASE_URL, configured } from './supabase';

/**
 * Shared pieces for generated share images: link previews (1200×630) and Instagram story cards (1080×1920).
 * Rendered with next/og; every element with more than one child needs display:flex.
 */
export const INK = '#070910', INK2 = '#11141d', BLUE = '#047eef', PAPER = '#fdfdfd', MIST = '#f2f2f2', DIM = '#8a90a0', TEXT = '#14161c';

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 600 | 800; style: 'normal' }[]> | null = null;
export function ogFonts() {
  fonts ??= Promise.all(([['Medium', 500], ['SemiBold', 600], ['ExtraBold', 800]] as const).map(async ([file, weight]) => ({
    name: 'Urbanist', data: await readFile(join(process.cwd(), `assets/fonts/Urbanist-${file}.ttf`)), weight, style: 'normal' as const,
  })));
  return fonts;
}

/** Anonymous reads for crawlers and share images (no visitor session). */
export function publicApi(): MeloApi | null {
  if (!configured) return null;
  return createApi(createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
}
export async function read<T>(fn: (api: MeloApi) => Promise<T>, fallback: T): Promise<T> {
  const api = publicApi(); if (!api) return fallback;
  try { return await fn(api); } catch { return fallback; }
}

const svgUri = (svg: string) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
export const itemImage = (it: Pick<CatalogItem, 'id' | 'title' | 'type'> & { artwork_url?: string | null }, size = 600) =>
  it.artwork_url ? appleArt(it.artwork_url, size)! : svgUri(coverSvg(itemCover(it), 'og' + hash(it.id).toString(36), it.title));
export const artistImage = (id: string, name: string, art?: string | null) => (art ? appleArt(art, 600)! : svgUri(coverSvg(artistCover(id, name), 'oga' + hash(id).toString(36), name)));

export const host = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function Wordmark({ size = 44, color = PAPER }: { size?: number; color?: string }) {
  return <div style={{ display: 'flex', fontSize: size, fontWeight: 800, letterSpacing: -size * 0.04, color }}>melo<span style={{ color: BLUE }}>.</span></div>;
}

export function StarsRow({ r10, size = 34, color = BLUE }: { r10: number; size?: number; color?: string }) {
  return <div style={{ display: 'flex', gap: size * 0.12 }}>{[0, 1, 2, 3, 4].map(i => {
    const fill = Math.max(0, Math.min(1, (r10 - i * 2) / 2));
    return <div key={i} style={{ display: 'flex', position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 2.6l2.85 5.95 6.5.85-4.75 4.55 1.2 6.45L12 17.3 6.2 20.4l1.2-6.45L2.65 9.4l6.5-.85z" fill="#3a3f4d" /></svg>
      {fill > 0 && <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width: size * fill, height: size, overflow: 'hidden' }}><svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 2.6l2.85 5.95 6.5.85-4.75 4.55 1.2 6.45L12 17.3 6.2 20.4l1.2-6.45L2.65 9.4l6.5-.85z" fill={color} /></svg></div>}
    </div>;
  })}</div>;
}

export function Avatar({ name, color, size = 56 }: { name: string; color: string; size?: number }) {
  const init = name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return <div style={{ display: 'flex', width: size, height: size, borderRadius: size, background: color, color: '#fff', fontSize: size * 0.38, fontWeight: 800, alignItems: 'center', justifyContent: 'center' }}>{init}</div>;
}

/** Shortens long text for a fixed-size card without cutting a word in half. */
export function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

/** The fallback card when something can't be found: the brand on ink. */
export function Fallback({ line }: { line: string }) {
  return <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: INK, color: PAPER, padding: 72, justifyContent: 'space-between', fontFamily: 'Urbanist' }}>
    <Wordmark size={64} />
    <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{line}</div>
    <div style={{ display: 'flex', fontSize: 28, color: DIM, fontWeight: 600 }}>{host}</div>
  </div>;
}
