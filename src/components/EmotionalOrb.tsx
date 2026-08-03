import React, { memo, useEffect, useId, useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, RadialGradient, Stop as SvgStop } from 'react-native-svg';

import { useTheme } from '@/design/theme';
import { motion } from '@/design/tokens';
import { emotionColor, emotionDeep } from '@/emotions/palette';
import type { Feeling, Orb } from '@/store/orb';
import { leadFeeling } from '@/store/orb';

type Props = {
  orb: Orb | null;
  size: number;
  breathing?: boolean;
  placeholder?: boolean;
  glow?: boolean;
  /** Small orbs skip the expensive passes; the read is the same at 40pt. */
  detail?: 'full' | 'simple';
  style?: ViewStyle;
};

const GOLDEN = 2.399963;

/** Where a surface wash sits. Derived, so the user never positions anything. */
const placeOf = (f: Feeling, i: number) => {
  const angle = GOLDEN * (i + 1) + f.seed * Math.PI * 2;
  const r = f.place === 'edge' ? 0.72 : 0.2 + f.seed * 0.34;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
};

/**
 * One day, rendered.
 *
 * Every mark here is generated from the description of the day — a colour, a
 * placement, a presence — so imprecise input cannot produce a broken result.
 * There is no user-drawn geometry anywhere in this file, which is exactly why
 * the output is always composed.
 */
export const EmotionalOrb = memo(
  ({
    orb,
    size,
    breathing = false,
    placeholder = false,
    glow = true,
    detail = 'full',
    style,
  }: Props) => {
    const { c, reduceMotion } = useTheme();
    const breath = useSharedValue(0);
    const animate = breathing && !reduceMotion;

    useEffect(() => {
      if (!animate) {
        breath.value = withTiming(0, { duration: motion.control });
        return;
      }
      breath.value = withRepeat(
        withTiming(1, { duration: motion.breathe, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }, [animate, breath]);

    const bodyStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 + breath.value * 0.016 }],
    }));

    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const r = size / 2;

    const model = useMemo(() => {
      const fs = orb?.feelings ?? [];
      const lead = leadFeeling(orb);
      return {
        lead,
        surface: fs.filter((f) => f.place === 'surface' && f.id !== lead?.id),
        cores: fs.filter((f) => f.place === 'core'),
        edges: fs.filter((f) => f.place === 'edge'),
        moments: fs.filter((f) => f.place === 'moment'),
        clarity: orb?.clarity ?? 0.7,
        seed: orb ? hash(orb.day) : 0.5,
      };
    }, [orb]);

    if (placeholder || !model.lead) {
      return (
        <Animated.View style={[{ width: size, height: size }, bodyStyle, style]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id={`e-${uid}`} cx="40%" cy="34%" r="74%">
                <SvgStop offset="0%" stopColor={c.surface} stopOpacity={0.95} />
                <SvgStop offset="100%" stopColor={c.well} stopOpacity={0.92} />
              </RadialGradient>
            </Defs>
            <Circle cx={r} cy={r} r={r - 1.5} fill={`url(#e-${uid})`} />
            <Circle
              cx={r}
              cy={r}
              r={r - 1.5}
              fill="none"
              stroke={c.lineStrong}
              strokeWidth={1.2}
              strokeDasharray={`${Math.max(3, size * 0.03)} ${Math.max(5, size * 0.048)}`}
            />
          </Svg>
        </Animated.View>
      );
    }

    const base = emotionColor(model.lead.emotion);
    const simple = detail === 'simple';

    // Light comes from the same corner every time, but shifts a few degrees per
    // day, which is enough to stop a wall of orbs looking stamped.
    const lightX = 0.34 + model.seed * 0.12;
    const lightY = 0.28 + (1 - model.seed) * 0.1;

    // Conflicting feelings marble; a settled day blends smoothly.
    const conflict = 1 - model.clarity;
    const marbled = !simple && model.surface.length > 0 && conflict > 0.3;

    return (
      <View style={[{ width: size, height: size }, style]}>
        {glow ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: size * 0.11,
              top: size * 0.17,
              width: size * 0.78,
              height: size * 0.78,
              borderRadius: size * 0.39,
              backgroundColor: base,
              opacity: 0.13,
              shadowColor: base,
              shadowOffset: { width: 0, height: size * 0.06 },
              shadowOpacity: 0.4,
              shadowRadius: size * 0.19,
            }}
          />
        ) : null}

        <Animated.View style={bodyStyle}>
          <Svg width={size} height={size}>
            <Defs>
              <ClipPath id={`face-${uid}`}>
                <Circle cx={r} cy={r} r={r - 1} />
              </ClipPath>

              {/* The body: lit shoulder, true colour, deeper toward the limb. */}
              <RadialGradient
                id={`body-${uid}`}
                cx={`${lightX * 100}%`}
                cy={`${lightY * 100}%`}
                r="84%"
              >
                <SvgStop offset="0%" stopColor={tint(base, 96)} stopOpacity={1} />
                <SvgStop offset="46%" stopColor={tint(base, 40)} stopOpacity={1} />
                <SvgStop offset="100%" stopColor={base} stopOpacity={0.94} />
              </RadialGradient>

              {/* Other surface feelings, as soft off-centre washes. */}
              {model.surface.map((f, i) => {
                const p = placeOf(f, i);
                return (
                  <RadialGradient
                    key={f.id}
                    id={`s-${uid}-${i}`}
                    cx={`${50 + p.x * 50}%`}
                    cy={`${50 + p.y * 50}%`}
                    r={`${34 + f.presence * 44}%`}
                  >
                    <SvgStop
                      offset="0%"
                      stopColor={emotionColor(f.emotion)}
                      stopOpacity={0.34 + f.presence * 0.5}
                    />
                    <SvgStop
                      offset="58%"
                      stopColor={emotionColor(f.emotion)}
                      stopOpacity={(0.34 + f.presence * 0.5) * 0.36}
                    />
                    <SvgStop offset="100%" stopColor={emotionColor(f.emotion)} stopOpacity={0} />
                  </RadialGradient>
                );
              })}

              {/* Marbling: the same colours pulled the other way, faintly. */}
              {marbled
                ? model.surface.map((f, i) => {
                    const p = placeOf(f, i);
                    return (
                      <RadialGradient
                        key={`m${f.id}`}
                        id={`mb-${uid}-${i}`}
                        cx={`${50 - p.x * 62}%`}
                        cy={`${50 - p.y * 62}%`}
                        r={`${52 + f.presence * 30}%`}
                      >
                        <SvgStop
                          offset="0%"
                          stopColor={emotionDeep(f.emotion)}
                          stopOpacity={0.1 + conflict * 0.16}
                        />
                        <SvgStop offset="100%" stopColor={emotionDeep(f.emotion)} stopOpacity={0} />
                      </RadialGradient>
                    );
                  })
                : null}

              {/* The private one, sunk into the middle. */}
              {model.cores.map((f, i) => (
                <RadialGradient key={f.id} id={`c-${uid}-${i}`} cx="50%" cy="52%" r="58%">
                  <SvgStop
                    offset="0%"
                    stopColor={emotionDeep(f.emotion)}
                    stopOpacity={0.42 + f.presence * 0.5}
                  />
                  <SvgStop
                    offset={`${24 + f.presence * 26}%`}
                    stopColor={emotionColor(f.emotion)}
                    stopOpacity={0.3 + f.presence * 0.3}
                  />
                  <SvgStop offset="86%" stopColor={emotionColor(f.emotion)} stopOpacity={0} />
                </RadialGradient>
              ))}

              {/* Never quite gone: a ring that lives at the rim. */}
              {model.edges.map((f, i) => (
                <RadialGradient key={f.id} id={`g-${uid}-${i}`} cx="50%" cy="50%" r="50%">
                  <SvgStop offset={`${52 - f.presence * 14}%`} stopColor={emotionColor(f.emotion)} stopOpacity={0} />
                  <SvgStop offset="100%" stopColor={emotionColor(f.emotion)} stopOpacity={0.3 + f.presence * 0.45} />
                </RadialGradient>
              ))}

              {/* Haze, when the day never resolved. */}
              {!simple && conflict > 0.45 ? (
                <RadialGradient id={`hz-${uid}`} cx="50%" cy="50%" r="72%">
                  <SvgStop offset="0%" stopColor="#FBF8F1" stopOpacity={(conflict - 0.45) * 0.5} />
                  <SvgStop offset="100%" stopColor="#FBF8F1" stopOpacity={0} />
                </RadialGradient>
              ) : null}

              <RadialGradient id={`sh-${uid}`} cx="50%" cy="50%" r="50%">
                <SvgStop offset="68%" stopColor="#2A2118" stopOpacity={0} />
                <SvgStop offset="100%" stopColor="#2A2118" stopOpacity={0.24} />
              </RadialGradient>
              <RadialGradient id={`sp-${uid}`} cx="50%" cy="50%" r="50%">
                <SvgStop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
                <SvgStop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>

            <G clipPath={`url(#face-${uid})`}>
              <Circle cx={r} cy={r} r={r - 1} fill={`url(#body-${uid})`} />

              {marbled
                ? model.surface.map((_, i) => (
                    <Circle key={`mb${i}`} cx={r} cy={r} r={r - 1} fill={`url(#mb-${uid}-${i})`} />
                  ))
                : null}

              {model.surface.map((_, i) => (
                <Circle key={`s${i}`} cx={r} cy={r} r={r - 1} fill={`url(#s-${uid}-${i})`} />
              ))}

              {model.cores.map((_, i) => (
                <Circle key={`c${i}`} cx={r} cy={r} r={r - 1} fill={`url(#c-${uid}-${i})`} />
              ))}

              {/* Brief moments: a few small soft flecks, never a pattern. */}
              {!simple
                ? model.moments.flatMap((f, i) =>
                    Array.from({ length: 3 }, (_, n) => {
                      const a = GOLDEN * (n + 1) + f.seed * 6.283;
                      const rad = 0.3 + ((f.seed * 7 + n) % 10) / 10 * 0.42;
                      const dot = size * (0.026 + f.presence * 0.03);
                      return (
                        <Circle
                          key={`f${i}-${n}`}
                          cx={r + Math.cos(a) * rad * r}
                          cy={r + Math.sin(a) * rad * r}
                          r={dot}
                          fill={emotionColor(f.emotion)}
                          fillOpacity={0.32 + f.presence * 0.34}
                        />
                      );
                    })
                  )
                : null}

              {model.edges.map((_, i) => (
                <Circle key={`g${i}`} cx={r} cy={r} r={r - 1} fill={`url(#g-${uid}-${i})`} />
              ))}

              {!simple && conflict > 0.45 ? (
                <Circle cx={r} cy={r} r={r - 1} fill={`url(#hz-${uid})`} />
              ) : null}

              <Circle cx={r} cy={r} r={r - 1} fill={`url(#sh-${uid})`} />
              <Circle cx={r * lightX * 2} cy={r * lightY * 2} r={r * 0.26} fill={`url(#sp-${uid})`} />
            </G>
          </Svg>
        </Animated.View>
      </View>
    );
  }
);
EmotionalOrb.displayName = 'EmotionalOrb';

/** Tint toward paper, for the lit shoulder of the body. */
const tint = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(amount * 0.96));
  const b = Math.min(255, (n & 255) + Math.round(amount * 0.88));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};
