import { Platform } from 'react-native';

/**
 * Riley's design tokens.
 *
 * The interface is deliberately almost colourless. Every saturated colour on
 * screen should belong to an orb — the surfaces around it are paper, ink and
 * shadow, nothing more.
 */

export type Scheme = 'light' | 'dark';

/** The full set of surface colours a scheme must define. */
export type Palette = {
  canvas: string;
  surface: string;
  well: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentSoft: string;
  lift: string;
  drop: string;
  dropSoft: string;
  grain: string;
  danger: string;
};

/** Warm paper in daylight; smoked linen at night. */
export const colors: Record<Scheme, Palette> = {
  light: {
    /** Page. Warm ivory, never pure white. */
    canvas: '#F4F1EA',
    /** Very slightly lifted page, for the app's few raised surfaces. */
    surface: '#FAF8F3',
    /** Pressed / inset wells. */
    well: '#EDE9E1',
    /** Ink. Deep brown-black, easier on the eye than #000. */
    ink: '#221F1A',
    inkSoft: '#635D53',
    inkFaint: '#726D64',
    /** Hairlines and dividers. */
    line: 'rgba(34,31,26,0.09)',
    lineStrong: 'rgba(34,31,26,0.16)',
    /** Restrained sage. Used for the single active state, nothing else. */
    accent: '#5F7355',
    accentSoft: 'rgba(95,115,85,0.12)',
    /** Neumorphic light source: top-left highlight, bottom-right shadow. */
    lift: 'rgba(255,255,255,0.92)',
    drop: 'rgba(120,110,95,0.20)',
    dropSoft: 'rgba(120,110,95,0.11)',
    /** Paper grain overlay. */
    grain: 'rgba(120,105,80,0.035)',
    danger: '#9C4A33',
  },
  dark: {
    canvas: '#15140F',
    surface: '#1D1B16',
    well: '#131210',
    ink: '#EDE8DE',
    inkSoft: '#A8A196',
    inkFaint: '#898278',
    line: 'rgba(237,232,222,0.10)',
    lineStrong: 'rgba(237,232,222,0.18)',
    accent: '#93A585',
    accentSoft: 'rgba(147,165,133,0.14)',
    lift: 'rgba(255,252,244,0.055)',
    drop: 'rgba(0,0,0,0.55)',
    dropSoft: 'rgba(0,0,0,0.32)',
    grain: 'rgba(255,240,210,0.022)',
    danger: '#C4705A',
  },
};

/**
 * Two typefaces, and the serif is rationed. Both ship with iOS, so there is no
 * webfont to load and no reflow on launch.
 */
export const fonts = {
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
} as const;

/**
 * Type scale. Sizes are multiplied by the OS text-size setting at render time,
 * so these are the 100% values.
 */
export const typeScale = {
  /** Reserved for one or two words per screen. Serif italic. */
  display: { size: 32, lineHeight: 38, weight: '400' as const, serif: true, italic: true },
  title: { size: 24, lineHeight: 30, weight: '600' as const, letterSpacing: -0.4 },
  heading: { size: 17, lineHeight: 23, weight: '600' as const, letterSpacing: -0.2 },
  body: { size: 16, lineHeight: 25, weight: '400' as const },
  /** Journal prose. A touch larger and looser than UI body copy. */
  prose: { size: 17, lineHeight: 28, weight: '400' as const },
  quote: { size: 17, lineHeight: 27, weight: '400' as const, serif: true, italic: true },
  label: { size: 14, lineHeight: 19, weight: '500' as const },
  caption: { size: 13, lineHeight: 17, weight: '400' as const },
  /** The date line. Small, tracked, never shouty. */
  meta: { size: 11.5, lineHeight: 15, weight: '600' as const, letterSpacing: 0.9 },
} as const;

export type TypeRole = keyof typeof typeScale;

/** 4pt base grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
  xxl: 48,
  xxxl: 72,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

/**
 * Elevation is used sparingly: `raised` for the few tactile controls, `inset`
 * for wells the user presses into. Nothing else gets a shadow.
 */
export const elevation = {
  raised: {
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    shadowOpacity: 1,
    elevation: 3,
  },
  raisedSoft: {
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 2,
  },
  floating: {
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    shadowOpacity: 1,
    elevation: 8,
  },
} as const;

/**
 * Motion. Durations follow the brief: quick acknowledgement for taps, unhurried
 * everywhere else. Every value is bypassed when Reduce Motion is on.
 */
export const motion = {
  press: 140,
  control: 180,
  screen: 300,
  morph: 460,
  breathe: 6200,
  /** Weighted, slightly overdamped. Nothing in Riley should bounce. */
  spring: { damping: 20, stiffness: 170, mass: 1 },
  springSoft: { damping: 26, stiffness: 105, mass: 1.1 },
  springSettle: { damping: 30, stiffness: 70, mass: 1.3 },
} as const;

/** Minimum tappable area, per the iOS HIG. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TARGET = 44;
