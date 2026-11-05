import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon, type IconName } from '../../components/ui';
import { C, F, shadow } from '../../components/theme';
import { useSession } from '../../lib/session';
import { go } from '../../lib/hooks';

const TABS: Record<string, { label: string; icon: IconName; on: IconName }> = {
  index: { label: 'Home', icon: 'house', on: 'house.fill' },
  discover: { label: 'Discover', icon: 'safari', on: 'safari' },
  activity: { label: 'Activity', icon: 'bell', on: 'bell' },
  me: { label: 'You', icon: 'person.crop.circle', on: 'person.crop.circle.fill' },
};
const ORDER = ['index', 'discover', '+', 'activity', 'me'];

/** Floating bar: four tabs and a raised compose button in the middle. */
function Bar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { user, unread } = useSession();
  const current = state.routes[state.index]?.name;
  return <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom - 6, 10) }]}>
    <View style={s.bar}>
      {ORDER.map(name => {
        if (name === '+') return <Pressable key="+" accessibilityRole="button" accessibilityLabel="New post" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); go(user ? '/compose' : '/login'); }}
          style={({ pressed }) => [s.plus, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}><Icon name="plus" size={26} color="#fff" weight={2.6} /></Pressable>;
        const t = TABS[name]; const route = state.routes.find(r => r.name === name); if (!t || !route) return null;
        const focused = current === name;
        return <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={name === 'activity' && unread ? `${t.label}, ${unread} new` : t.label}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigateToTab(route.key);
          }} style={s.tab}>
          <View>
            <Icon name={focused ? t.on : t.icon} size={23} color={focused ? C.blue : C.faint} weight={focused ? 2.3 : 1.9} />
            {name === 'activity' && unread > 0 && <View style={s.dot}><Text style={s.dotText}>{unread > 9 ? '9+' : unread}</Text></View>}
          </View>
          <Text style={[s.label, { color: focused ? C.blue : C.faint }]}>{t.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export default function TabsLayout() {
  return <Tabs tabBar={p => <Bar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
    <Tabs.Screen name="index" />
    <Tabs.Screen name="discover" />
    <Tabs.Screen name="activity" />
    <Tabs.Screen name="me" />
  </Tabs>;
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 30, height: 66, paddingHorizontal: 8, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: C.line, ...shadow(2) },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontFamily: F.semibold, fontSize: 10.5 },
  plus: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  dot: { position: 'absolute', top: -5, right: -10, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.heart, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
  dotText: { color: '#fff', fontFamily: F.bold, fontSize: 9.5 },
});
