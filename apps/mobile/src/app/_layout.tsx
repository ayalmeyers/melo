import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold } from '@expo-google-fonts/urbanist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider, useSession } from '../lib/session';
import { usePushTaps } from '../lib/push';
import { C, F } from '../components/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { user, profile, ready } = useSession();
  const seg = useSegments();
  usePushTaps();
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    // Signed in without a profile (or without accepting the terms): finish onboarding first.
    if (user && (!profile || !profile.accepted_terms_at) && seg[0] !== 'onboarding') router.replace('/onboarding');
  }, [ready, user, profile, seg]);
  return null;
}

export default function Root() {
  const [loaded] = useFonts({ Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold });
  if (!loaded) return null;
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
    <SessionProvider>
      <StatusBar style="dark" />
      <Gate />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerShadowVisible: false,
        headerTitleStyle: { fontFamily: F.bold, color: C.text, fontSize: 17 }, headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: C.bg },
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="compose" options={{ presentation: 'modal', title: 'New post' }} />
        <Stack.Screen name="add-item" options={{ presentation: 'modal', title: 'Add to Melo' }} />
        <Stack.Screen name="log/[id]" options={{ presentation: 'formSheet', title: 'Log it', sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="ask" options={{ presentation: 'modal', title: 'Ask the crowd' }} />
        <Stack.Screen name="item/[id]" options={{ title: '' }} />
        <Stack.Screen name="artist/[id]" options={{ title: '' }} />
        <Stack.Screen name="genre/[id]" options={{ title: '' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
        <Stack.Screen name="forecast/[id]" options={{ title: 'Forecast' }} />
        <Stack.Screen name="user/[handle]" options={{ title: '' }} />
        <Stack.Screen name="wiki/[key]" options={{ title: 'Edit wiki' }} />
        <Stack.Screen name="chats/index" options={{ title: 'Chats' }} />
        <Stack.Screen name="chats/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="chats/new" options={{ presentation: 'modal', title: 'New chat' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="moderation" options={{ title: 'Moderation' }} />
        <Stack.Screen name="charts" options={{ title: '' }} />
        <Stack.Screen name="forecasts" options={{ title: '' }} />
        <Stack.Screen name="list/[id]" options={{ title: '' }} />
        <Stack.Screen name="list/new" options={{ presentation: 'modal', title: 'New list' }} />
        <Stack.Screen name="list/add" options={{ presentation: 'modal', title: 'Add albums' }} />
        <Stack.Screen name="add-to-list/[itemId]" options={{ presentation: 'formSheet', title: 'Add to list', sheetAllowedDetents: [0.6, 1] }} />
      </Stack>
    </SessionProvider>
  </GestureHandlerRootView>;
}
