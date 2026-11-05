import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import * as L from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { appleArt, artistCover, seedArtistArt, seedGenreArt, seedItemArt, genreCover, hash, initials, itemCover, type CatalogItem, type Cover as CoverT } from '@melo/core';
import { cachedArtist, cachedItem, genreArtCache } from '../lib/hooks';
import { useArtVersion, wantArt } from '../lib/artwork';
import { C, F, R, shadow } from './theme';

/* ---------- text ---------- */
type TP = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; onPress?: () => void };
export const T = {
  // Headings are announced as headings to VoiceOver; large text scales with Dynamic Type up to a point the layout can hold.
  Display: (p: TP) => <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} {...p} style={[s.display, p.style]} />,
  H1: (p: TP) => <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} {...p} style={[s.h1, p.style]} />,
  H2: (p: TP) => <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} {...p} style={[s.h2, p.style]} />,
  Body: (p: TP) => <Text {...p} style={[s.body, p.style]} />,
  Dim: (p: TP) => <Text {...p} style={[s.dim, p.style]} />,
  Label: (p: TP) => <Text {...p} style={[s.label, p.style]} />,
  Bold: (p: TP) => <Text {...p} style={[s.bold, p.style]} />,
};

/* ---------- icons (Lucide, drawn with SVG so they look the same on iPhone, Android and web) ---------- */
const ICONS = {
  house: L.House, 'house.fill': L.House, safari: L.Compass, bell: L.Bell, 'bell.badge': L.BellDot,
  heart: L.Heart, 'heart.fill': L.Heart, 'star.fill': L.Star, star: L.Star,
  'bubble.left': L.MessageCircle, 'bubble.left.and.bubble.right': L.MessagesSquare, 'bubble.left.and.bubble.right.fill': L.MessagesSquare, 'text.bubble': L.MessageSquareText,
  paperplane: L.Send, 'square.and.arrow.up': L.Share, 'square.and.pencil': L.SquarePen, pencil: L.Pencil,
  ellipsis: L.Ellipsis, 'ellipsis.circle': L.Ellipsis, xmark: L.X, 'xmark.circle.fill': L.CircleX,
  'chart.line.uptrend.xyaxis': L.TrendingUp, plus: L.Plus, 'plus.circle': L.CirclePlus, 'plus.circle.fill': L.CirclePlus, 'minus.circle': L.CircleMinus,
  'text.badge.plus': L.ListPlus, shield: L.Shield, 'play.circle': L.CirclePlay, 'music.note': L.Music,
  'arrow.down.circle': L.CircleArrowDown, 'arrow.clockwise': L.RotateCw, 'arrow.up': L.ArrowUp, 'arrow.up.right': L.ArrowUpRight,
  'checkmark.circle.fill': L.CircleCheck, circle: L.Circle, square: L.Square, 'checkmark.square.fill': L.SquareCheck,
  'chevron.up': L.ChevronUp, 'chevron.down': L.ChevronDown, 'chevron.right': L.ChevronRight, 'chevron.left': L.ChevronLeft,
  'eye.slash': L.EyeOff, 'rectangle.portrait.and.arrow.right': L.LogOut, magnifyingglass: L.Search, gearshape: L.Settings,
  'person.crop.circle': L.CircleUserRound, 'person.crop.circle.fill': L.CircleUserRound, person: L.UserRound, people: L.Users,
  flame: L.Flame, sparkles: L.Sparkles, headphones: L.Headphones, disc: L.Disc3, mic: L.Mic, trophy: L.Trophy, quote: L.Quote,
  'exclamationmark.triangle': L.TriangleAlert, 'wifi.slash': L.WifiOff, ticket: L.Ticket, repeat: L.Repeat2, waveform: L.AudioLines, list: L.ListMusic, library: L.Library, laugh: L.Laugh, bookmark: L.Bookmark,
} as const;
export type IconName = keyof typeof ICONS;
/** Names ending in .fill draw solid where the shape allows it (hearts, stars, checks); the rest draw heavier. */
export function Icon({ name, size = 22, color = C.text, weight }: { name: IconName; size?: number; color?: string; weight?: number }) {
  const Glyph = ICONS[name] ?? L.Circle;
  const solid = name.endsWith('.fill');
  const fillable = solid && /^(heart|star|checkmark|xmark|plus)/.test(name);
  return <Glyph size={size} color={fillable && /^(checkmark|xmark|plus)/.test(name) ? '#fff' : color} fill={fillable ? color : 'none'} strokeWidth={weight ?? (solid ? 2.3 : 1.9)} absoluteStrokeWidth={false} accessible={false} />;
}

/* ---------- covers ---------- */
export function Cover({ cover, size, radius = 12, round }: { cover: CoverT; size: number; radius?: number; round?: boolean }) {
  const gid = useMemo(() => 'g' + hash(cover.from + cover.to + cover.shapes.length + Math.random()).toString(36), [cover]);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: round ? size / 2 : radius, overflow: 'hidden', backgroundColor: C.mist }}>
    <Svg width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <Defs><LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={cover.from} /><Stop offset="1" stopColor={cover.to} /></LinearGradient></Defs>
      <Rect width={100} height={100} fill={`url(#${gid})`} />
      {cover.shapes.map((sh, i) => {
        switch (sh.kind) {
          case 'rect': return <Rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} fill={sh.fill} opacity={sh.opacity} transform={sh.rotate ? `rotate(${sh.rotate} 50 50)` : undefined} />;
          case 'circle': return <Circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill={sh.fill ?? 'none'} stroke={sh.stroke} strokeWidth={sh.strokeWidth} opacity={sh.opacity} />;
          case 'polygon': return <Polygon key={i} points={sh.points} fill={sh.fill} opacity={sh.opacity} />;
          case 'path': return <Path key={i} d={sh.d} fill={sh.fill} opacity={sh.opacity} />;
          case 'text': return <SvgText key={i} x={sh.x} y={sh.y} fontSize={sh.size} fontWeight="800" fill={sh.fill} letterSpacing={-1.5}>{sh.text}</SvgText>;
        }
      })}
      {cover.badge && <><Rect x={6} y={6} width={22} height={10} rx={3} fill="#070910" opacity={0.6} /><SvgText x={17} y={13.6} textAnchor="middle" fontSize={6.5} fontWeight="800" fill="#fff">{cover.badge}</SvgText></>}
    </Svg>
  </View>;
}
/** Real artwork from Apple when Melo has it, otherwise the generated cover. */
function Art({ uri, size, radius, round }: { uri: string; size: number; radius: number; round?: boolean }) {
  return <Image source={{ uri: appleArt(uri, size <= 64 ? 200 : 600) }} style={{ width: size, height: size, borderRadius: round ? size / 2 : radius, backgroundColor: C.card2 }} contentFit="cover" transition={150} recyclingKey={uri} accessibilityIgnoresInvertColors accessible={false} />;
}
export const ItemCover = ({ item, size, radius = 12 }: { item: Pick<CatalogItem, 'id' | 'title' | 'type'> & { artwork_url?: string | null }; size: number; radius?: number }) => {
  useArtVersion();
  const art = item.artwork_url ?? cachedItem(item.id)?.artwork_url ?? seedItemArt(item.id);
  useEffect(() => { if (!art && item.type !== 'episode') wantArt('item', item.id); }, [art, item.id, item.type]);
  return art ? <Art uri={art} size={size} radius={radius} /> : <Cover cover={itemCover(item)} size={size} radius={radius} />;
};
/** Artist photo when Melo has one, else their latest album art, else a generated cover. */
export const ArtistCover = ({ id, size, art }: { id: string; size: number; art?: string | null }) => {
  useArtVersion();
  const a = cachedArtist(id); const uri = art ?? a?.image_url ?? seedArtistArt(id) ?? a?.artwork_url;
  useEffect(() => { if (!a?.image_url && !seedArtistArt(id)) wantArt('artist', id); }, [a?.image_url, id]);
  return uri ? <Art uri={uri} size={size} radius={0} round /> : <Cover cover={artistCover(id, a?.name)} size={size} round />;
};
/** A genre is shown as a 2×2 mosaic of its album covers once it has four, else a generated cover. */
export const GenreCover = ({ id, size, radius = 12, covers }: { id: string; size: number; radius?: number; covers?: string[] }) => {
  const fromDb = covers ?? genreArtCache.get(id);
  const list = fromDb && fromDb.length >= 4 ? fromDb : seedGenreArt(id);
  if (list.length < 4) return <Cover cover={genreCover(id)} size={size} radius={radius} />;
  const h = size / 2;
  return <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.mist }}>
    {list.slice(0, 4).map(u => <Image key={u} source={{ uri: appleArt(u, 200) }} style={{ width: h, height: h }} contentFit="cover" />)}
  </View>;
};


/* ---------- avatars, stars ---------- */
export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? C.blue, borderWidth: size >= 40 ? 2 : 0, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: size * 0.36 }}>{initials(name)}</Text></View>;
}
export function Stars({ r10, size = 15, color = C.blue, onChange }: { r10: number; size?: number; color?: string; onChange?: (v: number) => void }) {
  const width = useRef(0);
  const pick = (x: number) => { if (!onChange || !width.current) return; const v = Math.max(1, Math.min(10, Math.ceil((x / width.current) * 10))); if (v !== r10) { Haptics.selectionAsync().catch(() => {}); onChange(v); } };
  return <View accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={`${(r10 / 2).toFixed(1)} out of 5 stars`}
    onLayout={e => { width.current = e.nativeEvent.layout.width; }}
    onStartShouldSetResponder={() => !!onChange} onMoveShouldSetResponder={() => !!onChange}
    onResponderGrant={e => pick(e.nativeEvent.locationX)} onResponderMove={e => pick(e.nativeEvent.locationX)}
    accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
    onAccessibilityAction={e => { if (!onChange) return; onChange(Math.max(0, Math.min(10, r10 + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))); }}
    style={{ flexDirection: 'row', gap: 2, alignSelf: 'flex-start' }}>
    {[0, 1, 2, 3, 4].map(i => { const fill = Math.max(0, Math.min(1, (r10 - i * 2) / 2)); return <View key={i} style={{ width: size, height: size }}><Icon name="star.fill" size={size} color="#DCDFE7" />{fill > 0 && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: size * fill, overflow: 'hidden' }}><Icon name="star.fill" size={size} color={color} /></View>}</View>; })}
  </View>;
}

/* ---------- buttons, chips, inputs ---------- */
type BtnProps = PressableProps & { title: string; kind?: 'primary' | 'ghost' | 'dark' | 'danger' | 'good' | 'soft'; small?: boolean; icon?: IconName; loading?: boolean; style?: StyleProp<ViewStyle> };
/** primary: solid blue. soft: blue tint. dark/ghost: white with a hairline (secondary). danger/good: solid. */
export function Button({ title, kind = 'primary', small, icon, loading, style, disabled, onPress, ...rest }: BtnProps) {
  const bg = { primary: C.blue, ghost: C.card, dark: C.card, soft: C.blueSoft, danger: C.bad, good: C.good }[kind];
  const fg = kind === 'ghost' || kind === 'dark' ? C.text : kind === 'soft' ? C.blue : '#fff';
  const outlined = kind === 'ghost' || kind === 'dark';
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={e => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(e); }} {...rest}
    style={({ pressed }) => [{ height: small ? 38 : 50, borderRadius: R.pill, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: title ? (small ? 16 : 22) : 0, minWidth: small ? 38 : 50, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, outlined && { borderWidth: 1, borderColor: C.line }, kind === 'primary' && !disabled && shadowBlue, style]}>
    {loading ? <ActivityIndicator color={fg} /> : <>{icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}{!!title && <Text style={{ color: fg, fontFamily: F.bold, fontSize: small ? 14.5 : 16 }}>{title}</Text>}</>}
  </Pressable>;
}
const shadowBlue: ViewStyle = { shadowColor: C.blue, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } };
/** Pill tab. Selected pills are tinted blue with a blue edge; the rest are white with a hairline. `dark` is kept for old call sites and ignored. */
export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; dark?: boolean; icon?: IconName }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
    style={({ pressed }) => ({ height: 36, paddingHorizontal: 15, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: on ? C.blue : C.line, backgroundColor: on ? C.blueSoft : C.card, opacity: pressed ? 0.8 : 1 })}>
    {icon && <Icon name={icon} size={15} color={on ? C.blue : C.dim} />}
    <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: on ? C.blue : C.text }}>{label}</Text>
  </Pressable>;
}
export function Input(p: TextInputProps & { dark?: boolean }) {
  return <TextInput placeholderTextColor={C.faint} {...p} style={[{ backgroundColor: C.card, color: C.text, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: F.medium }, p.multiline && { minHeight: 100, textAlignVertical: 'top' }, p.style]} />;
}
export const Card = ({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) => onPress
  ? <Pressable onPress={onPress} style={({ pressed }) => [s.card, { opacity: pressed ? 0.92 : 1 }, style]}>{children}</Pressable>
  : <View style={[s.card, style]}>{children}</View>;
export const Empty = ({ text }: { text: string }) => <Text style={[s.dim, { textAlign: 'center', paddingVertical: 28, lineHeight: 21 }]}>{text}</Text>;

/* ---------- screen chrome: a header area and the content below, both on the tinted background ---------- */
export function Band({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, gap: 14 }, style]}>{children}</View>;
}
export function Sheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 130, gap: 14 }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  display: { fontFamily: F.heavy, fontSize: 30, lineHeight: 34, color: C.text, letterSpacing: -0.8 },
  h1: { fontFamily: F.heavy, fontSize: 26, lineHeight: 30, color: C.text, letterSpacing: -0.5 },
  h2: { fontFamily: F.bold, fontSize: 20, color: C.text, letterSpacing: -0.2 },
  body: { fontFamily: F.medium, fontSize: 15.5, lineHeight: 23, color: C.text },
  dim: { fontFamily: F.medium, fontSize: 14, color: C.dim },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.8, color: C.dim, textTransform: 'uppercase' },
  bold: { fontFamily: F.bold, fontSize: 16, color: C.text },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 12, ...shadow(1) },
});
