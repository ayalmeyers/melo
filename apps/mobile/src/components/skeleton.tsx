import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, View, type DimensionValue, type ViewStyle } from 'react-native';
import { Button, Icon, T } from './ui';
import { C } from './theme';

/** A soft pulsing block that stands in for content while it loads. Holds still when Reduce Motion is on. */
export function Shimmer({ w = '100%', h = 14, r = 8, dark, style }: { w?: DimensionValue; h?: number; r?: number; dark?: boolean; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver: true }), Animated.timing(v, { toValue: 0.55, duration: 650, useNativeDriver: true })]));
      loop.start();
    });
    return () => loop?.stop();
  }, [v]);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: dark ? C.ink2 : C.line, opacity: v }, style]} />;
}

/** Placeholder shaped like a post card. */
export function PostSkeleton() {
  return <View style={{ backgroundColor: C.mist, borderRadius: 22, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Shimmer w={34} h={34} r={17} /><View style={{ gap: 6, flex: 1 }}><Shimmer w="45%" h={12} /><Shimmer w="25%" h={10} /></View></View>
    <Shimmer w="92%" /><Shimmer w="80%" /><Shimmer w="55%" />
  </View>;
}

/** Placeholder shaped like a row with a cover: albums, people, chart entries. */
export function RowSkeleton({ size = 54, round }: { size?: number; round?: boolean }) {
  return <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
    <Shimmer w={size} h={size} r={round ? size / 2 : 10} />
    <View style={{ gap: 7, flex: 1 }}><Shimmer w="60%" h={13} /><Shimmer w="38%" h={11} /></View>
  </View>;
}

/** n placeholders, announced once to VoiceOver as "Loading". */
export function Loading({ n = 4, kind = 'row', round }: { n?: number; kind?: 'row' | 'post'; round?: boolean }) {
  return <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: kind === 'post' ? 12 : 16 }}>
    {Array.from({ length: n }, (_, i) => kind === 'post' ? <PostSkeleton key={i} /> : <RowSkeleton key={i} round={round} />)}
  </View>;
}

/** Shown when a load fails (usually no connection): what happened and a retry. */
export function ErrorView({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  const offline = !message || /network|fetch|failed to fetch|timed? ?out|offline/i.test(message);
  return <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }} accessibilityLiveRegion="polite">
    <Icon name={offline ? 'wifi.slash' : 'exclamationmark.triangle'} size={28} color={C.dim} />
    <T.Bold>{offline ? 'You seem to be offline' : 'That didn’t load'}</T.Bold>
    <T.Dim style={{ textAlign: 'center' }}>{offline ? 'Check your connection and try again.' : message}</T.Dim>
    <Button small kind="ghost" title="Try again" icon="arrow.clockwise" onPress={onRetry} />
  </View>;
}
