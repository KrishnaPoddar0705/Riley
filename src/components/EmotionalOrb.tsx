import React, { memo, useEffect, useId, useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  RadialGradient,
  Stop as SvgStop,
} from 'react-native-svg';

import { useTheme } from '@/design/theme';
import { motion } from '@/design/tokens';
import { emotionColor, emotionDeep } from '@/emotions/palette';
import type { Orb, OrbStop } from '@/store/orb';

type Props = {
  orb: Orb | null;
  size: number;
  /** Slow inhale, only for today's unfinished orb. Ignored under Reduce Motion. */
  breathing?: boolean;
  /** Dashed ring + hollow face: "today is waiting". */
  placeholder?: boolean;
  /** Ambient glow beneath. Off inside dense views like the globe and calendar. */
  glow?: boolean;
  style?: ViewStyle;
};

/** Sort so `depth` stops paint underneath — that is what makes a darker centre read. */
const inPaintOrder = (stops: OrbStop[]) =>
  [...stops].sort((a, b) => Number(!!b.depth) - Number(!!a.depth));

/**
 * One day, rendered.
 *
 * The face is built from layered translucent radial washes rather than hard
 * regions, so two feelings meeting produce a third colour the way wet pigment
 * does. A single soft highlight gives it body; there is deliberately no rim
 * light, no bloom and no specular sparkle.
 */
export const EmotionalOrb = memo(
  ({ orb, size, breathing = false, placeholder = false, glow = true, style }: Props) => {
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
      transform: [{ scale: 1 + breath.value * 0.018 }],
    }));

    const stops = useMemo(() => inPaintOrder(orb?.stops ?? []), [orb]);
    const r = size / 2;
    // Unique per mounted instance, so gradient ids can never collide.
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

    if (placeholder || !stops.length) {
      return (
        <Animated.View style={[{ width: size, height: size }, bodyStyle, style]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id={`empty-${uid}`} cx="42%" cy="36%" r="72%">
                <SvgStop offset="0%" stopColor={c.surface} stopOpacity={0.9} />
                <SvgStop offset="100%" stopColor={c.well} stopOpacity={0.85} />
              </RadialGradient>
            </Defs>
            <Circle cx={r} cy={r} r={r - 1.5} fill={`url(#empty-${uid})`} />
            <Circle
              cx={r}
              cy={r}
              r={r - 1.5}
              fill="none"
              stroke={c.lineStrong}
              strokeWidth={1.25}
              strokeDasharray={`${Math.max(3, size * 0.028)} ${Math.max(5, size * 0.045)}`}
            />
          </Svg>
        </Animated.View>
      );
    }

    return (
      <View style={[{ width: size, height: size }, style]}>
        {glow ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: size * 0.1,
              top: size * 0.16,
              width: size * 0.8,
              height: size * 0.8,
              borderRadius: size * 0.4,
              backgroundColor: dominant(stops),
              opacity: 0.16,
              shadowColor: dominant(stops),
              shadowOffset: { width: 0, height: size * 0.06 },
              shadowOpacity: 0.5,
              shadowRadius: size * 0.22,
            }}
          />
        ) : null}
        <Animated.View style={bodyStyle}>
          <Svg width={size} height={size}>
            <Defs>
              {/* Base body: the orb's own volume, before any feeling lands on it. */}
              <RadialGradient id={`base-${uid}`} cx="40%" cy="34%" r="76%">
                <SvgStop offset="0%" stopColor={lighten(dominant(stops))} stopOpacity={0.95} />
                <SvgStop offset="62%" stopColor={dominant(stops)} stopOpacity={0.72} />
                <SvgStop offset="100%" stopColor={darkest(stops)} stopOpacity={0.88} />
              </RadialGradient>

              {stops.map((s, i) => (
                <RadialGradient
                  key={s.id}
                  id={`w-${uid}-${i}`}
                  cx={`${50 + s.x * 50}%`}
                  cy={`${50 + s.y * 50}%`}
                  r={`${28 + s.spread * 62}%`}
                >
                  <SvgStop
                    offset="0%"
                    stopColor={s.depth ? emotionDeep(s.emotion) : emotionColor(s.emotion)}
                    stopOpacity={0.2 + s.weight * 0.75}
                  />
                  <SvgStop
                    offset="55%"
                    stopColor={emotionColor(s.emotion)}
                    stopOpacity={(0.2 + s.weight * 0.75) * 0.45}
                  />
                  <SvgStop offset="100%" stopColor={emotionColor(s.emotion)} stopOpacity={0} />
                </RadialGradient>
              ))}

              {/* Occlusion at the far edge — gives the sphere its turn. */}
              <RadialGradient id={`shade-${uid}`} cx="50%" cy="50%" r="50%">
                <SvgStop offset="64%" stopColor="#000000" stopOpacity={0} />
                <SvgStop offset="100%" stopColor="#0E0C08" stopOpacity={0.3} />
              </RadialGradient>
              <RadialGradient id={`spec-${uid}`} cx="50%" cy="50%" r="50%">
                <SvgStop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
                <SvgStop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>

            <G>
              <Circle cx={r} cy={r} r={r - 1} fill={`url(#base-${uid})`} />
              {stops.map((_, i) => (
                <Circle key={i} cx={r} cy={r} r={r - 1} fill={`url(#w-${uid}-${i})`} />
              ))}
              <Circle cx={r} cy={r} r={r - 1} fill={`url(#shade-${uid})`} />
              <Circle cx={r * 0.74} cy={r * 0.62} r={r * 0.3} fill={`url(#spec-${uid})`} />
            </G>
          </Svg>
        </Animated.View>
      </View>
    );
  }
);
EmotionalOrb.displayName = 'EmotionalOrb';

const dominant = (stops: OrbStop[]) => {
  let best = stops[0];
  for (const s of stops) if (s.weight * (0.4 + s.spread) > best.weight * (0.4 + best.spread)) best = s;
  return emotionColor(best?.emotion);
};

const darkest = (stops: OrbStop[]) => {
  const d = stops.find((s) => s.depth);
  return emotionDeep((d ?? stops[0])?.emotion);
};

/** Cheap tint toward paper, for the lit shoulder of the base gradient. */
const lighten = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 58);
  const g = Math.min(255, ((n >> 8) & 255) + 54);
  const b = Math.min(255, (n & 255) + 48);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};
