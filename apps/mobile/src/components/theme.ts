import { Platform, type ViewStyle } from 'react-native';
import { radii } from '@melo/core';

/**
 * Melo light theme. Soft tinted background, white cards, one blue accent.
 * The old dark-band names (ink2, onInk, onInkDim…) map onto the light palette so every screen moves together.
 */
export const C = {
  bg: '#F4F5F9',
  card: '#FFFFFF',
  card2: '#EEF1F6',
  /** Surface for cards and inputs that sit on the tinted background. */
  mist: '#FFFFFF',
  /** Screen background (modals and forms included). */
  paper: '#F4F5F9',
  text: '#0E1116',
  dim: '#6A7080',
  faint: '#A2A7B4',
  line: '#E6E8EF',
  blue: '#047EEF',
  blueDeep: '#0367C4',
  blueSoft: '#E7F1FE',
  good: '#11A053',
  goodSoft: '#E5F6EC',
  bad: '#E5484D',
  badSoft: '#FDECEC',
  heart: '#F0365F',
  /** True dark, for small solid elements: toasts, badges, the stars. */
  ink: '#0E1116',
  // Legacy names from the dark design. Content that sat on the dark band now sits on the light background.
  ink2: '#FFFFFF',
  ink3: '#EEF1F6',
  onInk: '#0E1116',
  onInkDim: '#6A7080',
} as const;

export const R = { ...radii, pill: 999 } as const;
export const F = {
  regular: 'Urbanist_400Regular',
  medium: 'Urbanist_500Medium',
  semibold: 'Urbanist_600SemiBold',
  bold: 'Urbanist_700Bold',
  heavy: 'Urbanist_800ExtraBold',
} as const;
export const GUTTER = 20;

/** Soft lift for cards. iOS gets a real shadow; Android gets a light elevation. */
export const shadow = (level: 1 | 2 = 1): ViewStyle => Platform.select<ViewStyle>({
  android: { elevation: level === 1 ? 1 : 4 },
  default: { shadowColor: '#1A2340', shadowOpacity: level === 1 ? 0.06 : 0.12, shadowRadius: level === 1 ? 14 : 24, shadowOffset: { width: 0, height: level === 1 ? 4 : 10 } },
})!;
