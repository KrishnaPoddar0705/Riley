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
  ClipPath,
  Defs,
  G,
  Mask,
  Path,
  RadialGradient,
  Stop as SvgStop,
} from 'react-native-svg';

import { useTheme } from '@/design/theme';
import { motion } from '@/design/tokens';
import { emotionColor, emotionDeep } from '@/emotions/palette';
import type { Orb, OrbStop, OrbStroke } from '@/store/orb';
import { strokesOf } from '@/store/orb';

type Props = {
  orb: Orb | null;
  size: number;
  /** A stroke still under the finger, drawn on top of the saved ones. */
  live?: OrbStroke | null;
  breathing?: boolean;
  placeholder?: boolean;
  glow?: boolean;
  style?: ViewStyle;
};

/** `depth` stops paint underneath — that is what makes a darker centre read. */
const inPaintOrder = (stops: OrbStop[]) =>
  [...stops].sort((a, b) => Number(!!b.depth) - Number(!!a.depth));

/** Unit-disc path → SVG path, smoothed through the midpoints of each segment. */
const toPath = (stroke: OrbStroke, r: number) => {
  const p = stroke.pts;
  const X = (v: number) => r + v * r;
  if (!p.length) return '';
  if (p.length === 1) return `M ${X(p[0].x)} ${X(p[0].y)} L ${X(p[0].x) + 0.01} ${X(p[0].y)}`;
  let d = `M ${X(p[0].x)} ${X(p[0].y)}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    d += ` Q ${X(p[i].x)} ${X(p[i].y)} ${X(mx)} ${X(my)}`;
  }
  const last = p[p.length - 1];
  d += ` L ${X(last.x)} ${X(last.y)}`;
  return d;
};

/**
 * Each mark is laid down as a few concentric passes: a wide faint one, then
 * progressively tighter and stronger. That is what gives a stroke a soft
 * shoulder instead of the hard vector edge you would get from a single line.
 */
const PASSES: Record<OrbStroke['kind'], { w: number; o: number }[]> = {
  brush: [
    { w: 1.7, o: 0.16 },
    { w: 1.15, o: 0.3 },
    { w: 0.68, o: 0.5 },
  ],
  airbrush: [
    { w: 2.5, o: 0.09 },
    { w: 1.7, o: 0.12 },
    { w: 1.0, o: 0.16 },
  ],
  eraser: [{ w: 1.0, o: 1 }],
};

/**
 * One day, rendered.
 *
 * Washes and strokes are both translucent, so two feelings meeting produce a
 * third colour the way wet pigment does. The body underneath stays pale on
 * purpose — an over-dark base was turning every mixed orb to mud.
 */
export const EmotionalOrb = memo(
  ({ orb, size, live, breathing = false, placeholder = false, glow = true, style }: Props) => {
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
    const strokes = useMemo(() => {
      const saved = strokesOf(orb);
      return live ? [...saved, live] : saved;
    }, [orb, live]);

    const paint = strokes.filter((s) => s.kind !== 'eraser');
    const erasers = strokes.filter((s) => s.kind === 'eraser');

    const r = size / 2;
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const empty = !stops.length && !strokes.length;

    if (placeholder || empty) {
      return (
        <Animated.View style={[{ width: size, height: size }, bodyStyle, style]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id={`e-${uid}`} cx="40%" cy="34%" r="74%">
                <SvgStop offset="0%" stopColor={c.surface} stopOpacity={0.95} />
                <SvgStop offset="100%" stopColor={c.well} stopOpacity={0.9} />
              </RadialGradient>
            </Defs>
            <Circle cx={r} cy={r} r={r - 1.5} fill={`url(#e-${uid})`} />
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

    const lead = dominant(stops, paint);

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
              backgroundColor: lead,
              opacity: 0.14,
              shadowColor: lead,
              shadowOffset: { width: 0, height: size * 0.06 },
              shadowOpacity: 0.45,
              shadowRadius: size * 0.2,
            }}
          />
        ) : null}

        <Animated.View style={bodyStyle}>
          <Svg width={size} height={size}>
            <Defs>
              <ClipPath id={`face-${uid}`}>
                <Circle cx={r} cy={r} r={r - 1} />
              </ClipPath>

              {/* Eraser marks punch holes in the paint, back to the bare body. */}
              <Mask id={`mask-${uid}`}>
                <Circle cx={r} cy={r} r={r} fill="white" />
                {erasers.map((s) =>
                  PASSES.eraser.map((p, j) => (
                    <Path
                      key={`${s.id}-${j}`}
                      d={toPath(s, r)}
                      stroke="black"
                      strokeWidth={s.size * size * p.w}
                      strokeOpacity={s.flow}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))
                )}
              </Mask>

              {/* The bare sphere. Pale, so mixed paint stays legible on top. */}
              <RadialGradient id={`body-${uid}`} cx="38%" cy="32%" r="82%">
                <SvgStop offset="0%" stopColor={lighten(lead, 92)} stopOpacity={1} />
                <SvgStop offset="58%" stopColor={lighten(lead, 46)} stopOpacity={1} />
                <SvgStop offset="100%" stopColor={lead} stopOpacity={0.9} />
              </RadialGradient>

              {stops.map((s, i) => (
                <RadialGradient
                  key={s.id}
                  id={`w-${uid}-${i}`}
                  cx={`${50 + s.x * 50}%`}
                  cy={`${50 + s.y * 50}%`}
                  r={`${24 + s.spread * 54}%`}
                >
                  <SvgStop
                    offset="0%"
                    stopColor={s.depth ? emotionDeep(s.emotion) : emotionColor(s.emotion)}
                    stopOpacity={0.3 + s.weight * 0.66}
                  />
                  <SvgStop
                    offset="62%"
                    stopColor={emotionColor(s.emotion)}
                    stopOpacity={(0.3 + s.weight * 0.66) * 0.34}
                  />
                  <SvgStop offset="100%" stopColor={emotionColor(s.emotion)} stopOpacity={0} />
                </RadialGradient>
              ))}

              {/* Occlusion at the limb — light, or the sphere goes grey. */}
              <RadialGradient id={`sh-${uid}`} cx="50%" cy="50%" r="50%">
                <SvgStop offset="70%" stopColor="#2A2118" stopOpacity={0} />
                <SvgStop offset="100%" stopColor="#2A2118" stopOpacity={0.22} />
              </RadialGradient>
              <RadialGradient id={`sp-${uid}`} cx="50%" cy="50%" r="50%">
                <SvgStop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
                <SvgStop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>

            <G clipPath={`url(#face-${uid})`}>
              <Circle cx={r} cy={r} r={r - 1} fill={`url(#body-${uid})`} />

              <G mask={`url(#mask-${uid})`}>
                {stops.map((_, i) => (
                  <Circle key={i} cx={r} cy={r} r={r - 1} fill={`url(#w-${uid}-${i})`} />
                ))}
                {paint.map((s) =>
                  PASSES[s.kind].map((p, j) => (
                    <Path
                      key={`${s.id}-${j}`}
                      d={toPath(s, r)}
                      stroke={emotionColor(s.emotion)}
                      strokeWidth={s.size * size * p.w}
                      strokeOpacity={p.o * s.flow}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))
                )}
              </G>

              <Circle cx={r} cy={r} r={r - 1} fill={`url(#sh-${uid})`} />
              <Circle cx={r * 0.72} cy={r * 0.6} r={r * 0.28} fill={`url(#sp-${uid})`} />
            </G>
          </Svg>
        </Animated.View>
      </View>
    );
  }
);
EmotionalOrb.displayName = 'EmotionalOrb';

/** The heaviest pigment on the face, washes and strokes together. */
const dominant = (stops: OrbStop[], strokes: OrbStroke[]) => {
  let bestKey: string | undefined;
  let bestVal = 0;
  for (const s of stops) {
    const v = s.weight * (0.4 + s.spread);
    if (v > bestVal) {
      bestVal = v;
      bestKey = s.emotion;
    }
  }
  for (const s of strokes) {
    const v = s.size * s.flow * 2;
    if (v > bestVal) {
      bestVal = v;
      bestKey = s.emotion;
    }
  }
  return emotionColor(bestKey);
};

/** Tint toward paper by `amount` (0–255ish), for the lit shoulder of the body. */
const lighten = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(amount * 0.96));
  const b = Math.min(255, (n & 255) + Math.round(amount * 0.88));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};
