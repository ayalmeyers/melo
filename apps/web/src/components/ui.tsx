import { coverSvg, hash, initials, itemCover, artistCover, genreCover, type CatalogItem, type Cover as CoverT } from '@melo/core';

const PATHS: Record<string, string> = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19.5a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 4.6-6 8-6s6.4 2 8 6"/>',
  heart: '<path d="M12 20.2s-7.4-4.5-9.3-9.3C1.4 7.5 3.6 4.5 6.8 4.5c2 0 3.4 1 4.2 2.4.3.5 1.7.5 2 0 .8-1.4 2.2-2.4 4.2-2.4 3.2 0 5.4 3 4.1 6.4-1.9 4.8-9.3 9.3-9.3 9.3z"/>',
  laugh: '<circle cx="12" cy="12" r="9"/><path d="M7.8 13.5c.9 1.9 2.4 2.9 4.2 2.9s3.3-1 4.2-2.9z"/><path d="M8.8 9.4h.01M15.2 9.4h.01" stroke-width="2.8"/>',
  share: '<path d="M4.5 12.5v6a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-6M12 3.5v11M7.5 8 12 3.5 16.5 8"/>',
  back: '<path d="M19 12H5m6-6.5L4.5 12 11 18.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M6 9.5a6 6 0 1 1 12 0c0 5.5 2.5 7 2.5 7h-17S6 15 6 9.5zM10 20a2 2 0 0 0 4 0"/>',
  send: '<path d="M5 12h12M12 6l6 6-6 6"/>',
  play: '<path d="M7.5 4.8v14.4a.8.8 0 0 0 1.2.7l11.6-7.2a.8.8 0 0 0 0-1.4L8.7 4.1a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5 10 17.5 19.5 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  pen: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z"/>',
  sparkle: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  headphones: '<path d="M4 15.5V12a8 8 0 0 1 16 0v3.5"/><path d="M4 14.5h3v6H5.5A1.5 1.5 0 0 1 4 19zM20 14.5h-3v6h1.5A1.5 1.5 0 0 0 20 19z"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  comment: '<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>',
};
export function Icon({ name, size = 20, style }: { name: keyof typeof PATHS | string; size?: number; style?: React.CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }} />;
}

export function Art({ cover, label, size, round, className = '' }: { cover: CoverT; label: string; size?: number; round?: boolean; className?: string }) {
  const uid = 'c' + hash(label + JSON.stringify(cover.shapes.length) + cover.from).toString(36);
  return <div className={`art ${round ? 'round' : ''} ${className}`} style={size ? { width: size } : undefined} dangerouslySetInnerHTML={{ __html: coverSvg(cover, uid, label) }} />;
}
export const ItemArt = ({ item, size, className }: { item: Pick<CatalogItem, 'id' | 'title' | 'type'>; size?: number; className?: string }) => <Art cover={itemCover(item)} label={item.title} size={size} className={className} />;
export const ArtistArt = ({ id, name, size }: { id: string; name?: string; size?: number }) => <Art cover={artistCover(id, name)} label={name ?? id} size={size} round />;
export const GenreArt = ({ id, size }: { id: string; size?: number }) => <Art cover={genreCover(id)} label={id} size={size} />;

export function Avatar({ name, color, size = '' }: { name: string; color?: string; size?: '' | 'xs' | 'lg' | 'xl' }) {
  return <span className={`av ${size}`} style={{ background: color ?? '#047eef' }} aria-hidden="true">{initials(name)}</span>;
}

const STAR = '<path d="M12 2.6l2.85 5.95 6.5.85-4.75 4.55 1.2 6.45L12 17.3 6.2 20.4l1.2-6.45L2.65 9.4l6.5-.85z"/>';
export function Stars({ r10, size = 15 }: { r10: number; size?: number }) {
  const row = <span className="row">{[0, 1, 2, 3, 4].map(i => <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: STAR }} />)}</span>;
  return <span className="stars" role="img" aria-label={`${(r10 / 2).toFixed(1)} out of 5 stars`}><span className="off">{row}</span><span className="on" style={{ width: `${r10 * 10}%` }}>{row}</span></span>;
}

export function Gauge({ p }: { p: number | null }) {
  const r = 30, c = 2 * Math.PI * r, v = p ?? 0;
  return <div className="gauge" aria-label={p == null ? 'No forecasts yet' : `Crowd says ${p}%`}><svg viewBox="0 0 76 76" width="78" height="78"><circle cx="38" cy="38" r={r} fill="none" stroke="#dfe1e6" strokeWidth="7" /><circle cx="38" cy="38" r={r} fill="none" stroke="#047eef" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 38 38)" /></svg><b>{p == null ? '–' : p + '%'}</b></div>;
}
