import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './supabase';

// Show banners while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let current: string | null = null;

/** Gets this phone's Expo push token and saves it. Asks for permission only when `ask` is true. */
export async function registerPush(ask: boolean): Promise<'on' | 'off' | 'unavailable'> {
  if (!Device.isDevice) return 'unavailable';
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'off';
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    current = data;
    await api.savePushToken(data, Platform.OS === 'android' ? 'android' : 'ios');
    return 'on';
  } catch {
    return 'unavailable';
  }
}

/** Called on sign-out so the next person on this phone doesn't get the last person's notifications. */
export async function forgetPush() { if (current) await api.removePushToken(current).catch(() => {}); current = null; }

export async function pushStatus(): Promise<'on' | 'off' | 'unavailable'> {
  if (!Device.isDevice) return 'unavailable';
  try { return (await Notifications.getPermissionsAsync()).status === 'granted' ? 'on' : 'off'; } catch { return 'unavailable'; }
}

/** Opens the screen a tapped notification points at (its data.url, e.g. /post/123). */
function usePushTapsNative() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = last?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  }, [last]);
}

/** Notification taps only exist on phones; the web build skips the hook entirely. */
export const usePushTaps: () => void = Platform.OS === 'web' ? () => {} : usePushTapsNative;
