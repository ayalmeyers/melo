/**
 * Generative cover art. Real artwork is licensed, so until a licensed artwork
 * source is connected every release gets an original, deterministic cover.
 * The output is a list of plain shapes so the website (SVG strings) and the
 * iPhone app (react-native-svg) draw identical art.
 */
export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; opacity?: number; rotate?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'polygon'; points: string; fill: string; opacity?: number }
  | { kind: 'path'; d: string; fill: string; opacity?: number }
  | { kind: 'text'; x: number; y: number; text: string; size: number; fill: string };

export interface Cover { from: string; to: string; shapes: Shape[]; badge?: string }

const PALS: [string, string, string][] = [['#f2d7c9', '#b9c7d6', '#2b2d38'], ['#2a2a2a', '#5a5a5a', '#d9c7a7'], ['#c63b1d', '#f2a52b', '#141010'], ['#4fc3e8', '#ffd9a1', '#ff6f61'], ['#e7dfcf', '#9fbf9a', '#c0392b'], ['#dfe7ef', '#9db1c8', '#c8352f'], ['#f6c6d0', '#9cc9e8', '#ffffff'], ['#21426b', '#6ea8d6', '#f7f2e8'], ['#3d2b1f', '#a46a3c', '#f1d9b5'], ['#f4f4f4', '#d9d9d9', '#c1121f'], ['#0f3d2e', '#2f8f5b', '#f2c94c'], ['#f1e3c6', '#d18b2c', '#2b1d14'], ['#e9e2d6', '#7b8f8a', '#1e2a2a'], ['#047eef', '#0a2a52', '#fdfdfd'], ['#2b1d2e', '#d96a8f', '#ffe2b8'], ['#1d1b3a', '#5b4bd6', '#f5d76e'], ['#0e2f2f', '#1f7a6d', '#e8f3d6']];
const MOTIFS = ['orb', 'stripes', 'grid', 'sun', 'wave', 'split', 'peaks', 'rings', 'horizon', 'type'] as const;
export type Motif = typeof MOTIFS[number];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function cover(id: string, title: string, opts: { motif?: Motif; pal?: [string, string, string]; glyph?: string; episode?: boolean } = {}): Cover {
  const h = hash(id);
  const [a, b, c] = opts.pal ?? PALS[h % PALS.length];
  const motif: Motif = opts.motif ?? MOTIFS[(h >>> 5) % MOTIFS.length];
  const glyph = opts.glyph ?? (title.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'M');
  const s: Shape[] = [];
  switch (motif) {
    case 'orb': s.push({ kind: 'circle', cx: 60, cy: 42, r: 38, fill: c, opacity: 0.12 }, { kind: 'circle', cx: 60, cy: 42, r: 24, fill: c, opacity: 0.9 }, { kind: 'circle', cx: 36, cy: 74, r: 7, fill: c, opacity: 0.5 }); break;
    case 'stripes': for (let i = 0; i < 7; i++) s.push({ kind: 'rect', x: -30 + i * 20, y: -30, w: 6 + (i % 3) * 3, h: 170, fill: c, opacity: 0.3 + i * 0.1, rotate: 28 }); break;
    case 'grid': for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) s.push({ kind: 'circle', cx: 14 + x * 18, cy: 14 + y * 18, r: (x + y) % 3 === 0 ? 6 : 3.2, fill: c, opacity: (x * y) % 4 === 0 ? 0.95 : 0.45 }); break;
    case 'sun': s.push({ kind: 'circle', cx: 50, cy: 70, r: 32, fill: c }); for (let i = 0; i < 5; i++) s.push({ kind: 'rect', x: 0, y: 66 + i * 7, w: 100, h: 2 + i * 0.8, fill: b }); s.push({ kind: 'rect', x: 0, y: 86, w: 100, h: 14, fill: c, opacity: 0.85 }); break;
    case 'wave': [56, 68, 80].forEach((y, i) => s.push({ kind: 'path', d: `M0 ${y} Q25 ${y - 13} 50 ${y} T100 ${y} V100 H0Z`, fill: i === 1 ? c : '#ffffff', opacity: i === 1 ? 0.9 : 0.35 })); s.push({ kind: 'circle', cx: 74, cy: 28, r: 12, fill: '#ffffff', opacity: 0.9 }); break;
    case 'split': s.push({ kind: 'polygon', points: '0,100 100,18 100,100', fill: b }, { kind: 'circle', cx: 30, cy: 34, r: 16, fill: c }, { kind: 'rect', x: 60, y: 62, w: 26, h: 26, fill: c, opacity: 0.85 }); break;
    case 'peaks': s.push({ kind: 'polygon', points: '0,100 28,48 46,72 66,30 100,100', fill: c, opacity: 0.9 }, { kind: 'polygon', points: '0,100 40,66 72,84 100,60 100,100', fill: a, opacity: 0.7 }); break;
    case 'rings': for (let i = 6; i > 0; i--) s.push({ kind: 'circle', cx: 50, cy: 50, r: i * 8, stroke: c, strokeWidth: 2.4, opacity: 0.2 + (6 - i) * 0.13 }); s.push({ kind: 'circle', cx: 50, cy: 50, r: 5, fill: c }); break;
    case 'horizon': s.push({ kind: 'circle', cx: 50, cy: 58, r: 20, fill: c }, { kind: 'rect', x: 0, y: 58, w: 100, h: 42, fill: b, opacity: 0.85 }); for (let i = 0; i < 4; i++) s.push({ kind: 'rect', x: 10 + i * 8, y: 66 + i * 8, w: 80 - i * 16, h: 1.6, fill: c, opacity: 0.6 }); break;
    case 'type': s.push({ kind: 'text', x: 7, y: glyph.length > 3 ? 62 : 70, text: glyph, size: glyph.length > 3 ? 34 : 44, fill: c }); break;
  }
  return { from: a, to: b, shapes: s, badge: opts.episode ? 'EP' : undefined };
}

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** Renders a cover as an SVG string (website, share images). */
export function coverSvg(cv: Cover, uid: string, label = ''): string {
  const g = 'g' + uid.replace(/[^a-zA-Z0-9]/g, '');
  const parts = cv.shapes.map(sh => {
    const op = 'opacity' in sh && sh.opacity != null ? ` opacity="${sh.opacity}"` : '';
    switch (sh.kind) {
      case 'rect': return `<rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" fill="${sh.fill}"${op}${sh.rotate ? ` transform="rotate(${sh.rotate} 50 50)"` : ''}/>`;
      case 'circle': return `<circle cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}" fill="${sh.fill ?? 'none'}"${sh.stroke ? ` stroke="${sh.stroke}" stroke-width="${sh.strokeWidth ?? 1}"` : ''}${op}/>`;
      case 'polygon': return `<polygon points="${sh.points}" fill="${sh.fill}"${op}/>`;
      case 'path': return `<path d="${sh.d}" fill="${sh.fill}"${op}/>`;
      case 'text': return `<text x="${sh.x}" y="${sh.y}" font-family="Urbanist,Arial,sans-serif" font-weight="800" font-size="${sh.size}" letter-spacing="-1.5" fill="${sh.fill}">${esc(sh.text)}</text>`;
    }
  }).join('');
  const badge = cv.badge ? `<rect x="6" y="6" width="22" height="10" rx="3" fill="#070910" opacity=".6"/><text x="17" y="13.6" text-anchor="middle" font-family="Urbanist,Arial" font-weight="800" font-size="6.5" fill="#fff">${cv.badge}</text>` : '';
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cv.from}"/><stop offset="1" stop-color="${cv.to}"/></linearGradient></defs><rect width="100" height="100" fill="url(#${g})"/>${parts}${badge}</svg>`;
}
