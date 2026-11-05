import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { createApi, createDemoApi } from '@melo/core';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://melo.vercel.app';
/** Demo mode runs the whole app on sample data (design reviews, App Store screenshots). */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
export const configured = DEMO || Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = createClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_KEY || 'missing-key', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh sessions only while the app is in the foreground (Supabase's recommended setup for React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const api = DEMO ? createDemoApi() : createApi(supabase);
