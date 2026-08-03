import { Platform, TextStyle } from 'react-native';

/**
 * Riley's visual language: a pale lavender haze with soft clay surfaces,
 * and saturated glass orbs as the only place colour is allowed to shout.
 */

export const palette = {
  // Backdrop gradient, top -> bottom.
  haze: ['#F7F4FB', '#F2EDF8', '#F6EDF3', '#EFF1F9', '#F4F2F8'] as const,
  hazeDeep: ['#EDE7F6', '#F3EAF2', '#E9EEF9'] as const,

  ink: '#241F30',
  inkSoft: '#645D77',
  inkFaint: '#A29BB4',
  inkGhost: '#C9C3D6',

  surface: 'rgba(255,255,255,0.74)',
  surfaceSolid: '#FFFFFF',
  surfaceSunk: 'rgba(255,255,255,0.42)',
  hairline: 'rgba(255,255,255,0.85)',
  edge: 'rgba(120,105,160,0.10)',

  night: '#16131F',
  nightSoft: '#241F33',

  glowShadow: 'rgba(96, 79, 143, 0.20)',
  clayShadow: 'rgba(103, 88, 148, 0.13)',
} as const;

/** Every colour a memory can be. */
export const spectrum = {
  joy: '#FFC53D',
  love: '#FF7FA8',
  calm: '#63D8C6',
  confidence: '#7B5BFF',
  gratitude: '#96E06B',
  excitement: '#FF9A5B',
  longing: '#6C63FF',
  sadness: '#5B8DEF',
  anger: '#FF5C5C',
  fear: '#B47CFF',
  disgust: '#8FD14F',
  anxiety: '#FF8A3D',
  tired: '#9AA3C0',
  neutral: '#CFC9DC',
} as const;

export type SpectrumKey = keyof typeof spectrum;

/**
 * iOS ships a genuinely lovely script face (Snell Roundhand) and the New York
 * serif, so the display type costs us nothing to load. Elsewhere we fall back
 * to whatever serif the platform has.
 */
export const fonts = {
  script: Platform.select({ ios: 'Snell Roundhand', default: 'serif' }) as string,
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }) as string,
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
} as const;

export const type = {
  script: (size = 34): TextStyle => ({
    fontFamily: fonts.script,
    fontSize: size,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: 0.2,
  }),
  scriptSoft: (size = 26): TextStyle => ({
    fontFamily: fonts.script,
    fontSize: size,
    fontWeight: '600',
    color: palette.inkFaint,
  }),
  title: {
    fontFamily: fonts.body,
    fontSize: 27,
    fontWeight: '600',
    color: palette.ink,
    letterSpacing: -0.4,
  } as TextStyle,
  heading: {
    fontFamily: fonts.body,
    fontSize: 20,
    fontWeight: '600',
    color: palette.ink,
    letterSpacing: -0.2,
  } as TextStyle,
  body: {
    fontFamily: fonts.body,
    fontSize: 15.5,
    fontWeight: '400',
    color: palette.inkSoft,
    lineHeight: 23,
  } as TextStyle,
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: palette.inkSoft,
    letterSpacing: 0.1,
  } as TextStyle,
  caption: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    fontWeight: '500',
    color: palette.inkFaint,
    letterSpacing: 0.3,
  } as TextStyle,
  overline: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    fontWeight: '700',
    color: palette.inkFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;

/** `StyleSheet.absoluteFillObject` is no longer typed in RN 0.86; this replaces it. */
export const fill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 44,
} as const;

/** The soft, wide, barely-there drop shadow that makes a surface feel like clay. */
export const clay = {
  shadowColor: palette.clayShadow,
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 1,
  shadowRadius: 26,
  elevation: 6,
} as const;

export const clayTight = {
  shadowColor: palette.clayShadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 1,
  shadowRadius: 12,
  elevation: 3,
} as const;

/** Motion constants — everything in Riley eases the same way. */
export const motion = {
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 110, mass: 1 },
  springSnappy: { damping: 14, stiffness: 260, mass: 0.7 },
  fast: 180,
  base: 280,
  slow: 520,
} as const;
