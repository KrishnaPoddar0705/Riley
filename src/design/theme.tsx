import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  TextStyle,
  useColorScheme,
  ViewStyle,
} from 'react-native';

import {
  colors,
  elevation,
  fonts,
  motion,
  Palette,
  radius,
  Scheme,
  space,
  typeScale,
  TypeRole,
} from './tokens';

type Theme = {
  scheme: Scheme;
  c: Palette;
  /** Resolved text style for a role, already scaled for Dynamic Type. */
  t: (role: TypeRole, overrides?: TextStyle) => TextStyle;
  /** Softly extruded surface — the only thing in Riley that sits above the page. */
  raised: (level?: 'soft' | 'normal' | 'floating') => ViewStyle;
  /** Pressed-in well. Reads as a place to put something. */
  inset: () => ViewStyle;
  /** True when the OS asks us to hold still. */
  reduceMotion: boolean;
  /** True when the user has scaled text up; layouts loosen accordingly. */
  largeText: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

/** Clamped so a huge accessibility size can't shatter the orb layouts. */
const scaleFor = (size: number) => {
  const raw = PixelRatio.getFontScale();
  const clamped = Math.min(1.55, Math.max(0.85, raw));
  return Math.round(size * clamped * 10) / 10;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const system = useColorScheme();
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontScale, setFontScale] = useState(() => PixelRatio.getFontScale());

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(v)
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Dynamic Type can change while the app is backgrounded; re-read on focus.
  useEffect(() => {
    const id = setInterval(() => {
      const next = PixelRatio.getFontScale();
      setFontScale((prev) => (prev === next ? prev : next));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo<Theme>(() => {
    const c = colors[scheme];

    const t: Theme['t'] = (role, overrides) => {
      const s = typeScale[role] as (typeof typeScale)[TypeRole] & {
        serif?: boolean;
        italic?: boolean;
        letterSpacing?: number;
      };
      return {
        fontFamily: s.serif ? fonts.serif : fonts.sans,
        fontSize: scaleFor(s.size),
        lineHeight: scaleFor(s.lineHeight),
        fontWeight: s.weight,
        fontStyle: s.italic ? 'italic' : 'normal',
        letterSpacing: s.letterSpacing,
        color: c.ink,
        ...overrides,
      };
    };

    /**
     * Neumorphism, rationed. React Native gives one shadow per view, so the
     * "lit from the top-left" read comes from a light hairline border plus a
     * single soft drop — enough to feel pressed out of the page without the
     * puffy plastic look.
     */
    const raised: Theme['raised'] = (level = 'normal') => ({
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.lift,
      shadowColor: level === 'soft' ? c.dropSoft : c.drop,
      ...(level === 'floating'
        ? elevation.floating
        : level === 'soft'
          ? elevation.raisedSoft
          : elevation.raised),
    });

    const inset: Theme['inset'] = () => ({
      backgroundColor: c.well,
      borderWidth: 1,
      borderColor: c.line,
    });

    return {
      scheme,
      c,
      t,
      raised,
      inset,
      reduceMotion,
      largeText: fontScale > 1.15,
    };
  }, [scheme, reduceMotion, fontScale]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

export { space, radius, motion, fonts };
export type { Theme };
