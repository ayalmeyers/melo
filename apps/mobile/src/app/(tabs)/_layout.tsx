import { Tabs } from 'expo-router/tabs';
import { Icon } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: C.blue, tabBarInactiveTintColor: C.dim,
    tabBarStyle: { backgroundColor: C.paper, borderTopColor: C.line },
    tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 11 },
    sceneStyle: { backgroundColor: C.ink },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'house.fill' : 'house'} size={24} color={String(color)} /> }} />
    <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: ({ color }) => <Icon name="safari" size={24} color={String(color)} /> }} />
    <Tabs.Screen name="forecasts" options={{ title: 'Forecasts', tabBarIcon: ({ color }) => <Icon name="chart.line.uptrend.xyaxis" size={24} color={String(color)} /> }} />
    <Tabs.Screen name="me" options={{ title: 'You', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'person.crop.circle.fill' : 'person.crop.circle'} size={24} color={String(color)} /> }} />
  </Tabs>;
}
