import { useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { artistCover, genreCover, hash, initials, itemCover, type CatalogItem, type Cover as CoverT } from '@melo/core';
import { C, F, R } from './theme';

/* ---------- text ---------- */
type TP = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; onPress?: () => void };
export const T = {
  Display: (p: TP) => <Text {...p} style={[s.display, p.style]} />,
  H1: (p: TP) => <Text {...p} style={[s.h1, p.style]} />,
  H2: (p: TP) => <Text {...p} style={[s.h2, p.style]} />,
  Body: (p: TP) => <Text {...p} style={[s.body, p.style]} />,
  Dim: (p: TP) => <Text {...p} style={[s.dim, p.style]} />,
  Label: (p: TP) => <Text {...p} style={[s.label, p.style]} />,
  Bold: (p: TP) => <Text {...p} style={[s.bold, p.style]} />,
};

/* ---------- icons (SF Symbols) ---------- */
export function Icon({ name, size = 22, color = C.text }: { name: React.ComponentProps<typeof SymbolView>['name']; size?: number; color?: string }) {
  return <SymbolView name={name} size={size} tintColor={color} resizeMode="scaleAspectFit" style={{ width: size, height: size }} />;
}

/* ---------- covers ---------- */
export function Cover({ cover, size, radius = 12, round }: { cover: CoverT; size: number; radius?: number; round?: boolean }) {
  const gid = useMemo(() => 'g' + hash(cover.from + cover.to + cover.shapes.length + Math.random()).toString(36), [cover]);
  return <View style={{ width: size, height: size, borderRadius: round ? size / 2 : radius, overflow: 'hidden', backgroundColor: C.mist }}>
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
export const ItemCover = ({ item, size, radius }: { item: Pick<CatalogItem, 'id' | 'title' | 'type'>; size: number; radius?: number }) => <Cover cover={itemCover(item)} size={size} radius={radius} />;
export const ArtistCover = ({ id, size }: { id: string; size: number }) => <Cover cover={artistCover(id)} size={size} round />;
export const GenreCover = ({ id, size, radius }: { id: string; size: number; radius?: number }) => <Cover cover={genreCover(id)} size={size} radius={radius} />;

/* ---------- avatars, stars ---------- */
export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? C.blue, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: size * 0.36 }}>{initials(name)}</Text></View>;
}
export function Stars({ r10, size = 15, color = C.ink, onChange }: { r10: number; size?: number; color?: string; onChange?: (v: number) => void }) {
  const width = useRef(0);
  const pick = (x: number) => { if (!onChange || !width.current) return; const v = Math.max(1, Math.min(10, Math.ceil((x / width.current) * 10))); if (v !== r10) { Haptics.selectionAsync().catch(() => {}); onChange(v); } };
  return <View accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={`${(r10 / 2).toFixed(1)} out of 5 stars`}
    onLayout={e => { width.current = e.nativeEvent.layout.width; }}
    onStartShouldSetResponder={() => !!onChange} onMoveShouldSetResponder={() => !!onChange}
    onResponderGrant={e => pick(e.nativeEvent.locationX)} onResponderMove={e => pick(e.nativeEvent.locationX)}
    accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
    onAccessibilityAction={e => { if (!onChange) return; onChange(Math.max(0, Math.min(10, r10 + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))); }}
    style={{ flexDirection: 'row', gap: 2, alignSelf: 'flex-start' }}>
    {[0, 1, 2, 3, 4].map(i => { const fill = Math.max(0, Math.min(1, (r10 - i * 2) / 2)); return <View key={i} style={{ width: size, height: size }}><Icon name="star.fill" size={size} color="#d6d8de" />{fill > 0 && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: size * fill, overflow: 'hidden' }}><Icon name="star.fill" size={size} color={color} /></View>}</View>; })}
  </View>;
}

/* ---------- buttons, chips, inputs ---------- */
type BtnProps = PressableProps & { title: string; kind?: 'primary' | 'ghost' | 'dark' | 'danger' | 'good'; small?: boolean; icon?: React.ComponentProps<typeof SymbolView>['name']; loading?: boolean; style?: StyleProp<ViewStyle> };
export function Button({ title, kind = 'primary', small, icon, loading, style, disabled, onPress, ...rest }: BtnProps) {
  const bg = { primary: C.blue, ghost: C.mist, dark: C.ink3, danger: C.bad, good: C.good }[kind];
  const fg = kind === 'ghost' ? C.text : '#fff';
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={e => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(e); }} {...rest}
    style={({ pressed }) => [{ height: small ? 40 : 54, borderRadius: small ? 12 : 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: small ? 14 : 20, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
    {loading ? <ActivityIndicator color={fg} /> : <>{icon && <Icon name={icon} size={small ? 16 : 18} color={fg} />}<Text style={{ color: fg, fontFamily: F.semibold, fontSize: small ? 15 : 17 }}>{title}</Text></>}
  </Pressable>;
}
export function Chip({ label, on, onPress, dark = true }: { label: string; on?: boolean; onPress?: () => void; dark?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} style={{ height: 38, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: on ? (dark ? C.paper : C.ink) : dark ? C.ink2 : C.mist }}>
    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: on ? (dark ? C.ink : '#fff') : dark ? C.onInk : C.dim }}>{label}</Text>
  </Pressable>;
}
export function Input(p: TextInputProps & { dark?: boolean }) {
  return <TextInput placeholderTextColor={p.dark ? C.onInkDim : C.dim} {...p} style={[{ backgroundColor: p.dark ? C.ink2 : C.mist, color: p.dark ? '#fff' : C.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: F.medium }, p.multiline && { minHeight: 100, textAlignVertical: 'top' }, p.style]} />;
}
export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ backgroundColor: C.mist, borderRadius: R.lg, padding: 16, gap: 12 }, style]}>{children}</View>;
export const Empty = ({ text }: { text: string }) => <Text style={[s.dim, { textAlign: 'center', paddingVertical: 28 }]}>{text}</Text>;

/* ---------- screen chrome: ink band over a white sheet ---------- */
export function Band({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.ink, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 44, gap: 16 }, style]}>{children}</View>;
}
export function Sheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, marginTop: -30, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, gap: 18, minHeight: 500 }, style]}>{children}</View>;
}

const s = StyleSheet.create({
  display: { fontFamily: F.bold, fontSize: 32, lineHeight: 34, color: C.onInk, letterSpacing: -0.6 },
  h1: { fontFamily: F.bold, fontSize: 26, lineHeight: 30, color: C.text, letterSpacing: -0.3 },
  h2: { fontFamily: F.semibold, fontSize: 21, color: C.text },
  body: { fontFamily: F.regular, fontSize: 15.5, lineHeight: 23, color: C.text },
  dim: { fontFamily: F.medium, fontSize: 14, color: C.dim },
  label: { fontFamily: F.bold, fontSize: 12, letterSpacing: 1, color: C.dim, textTransform: 'uppercase' },
  bold: { fontFamily: F.bold, fontSize: 16, color: C.text },
});
