import * as Haptics from 'expo-haptics';
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { emotionColor } from '@/emotions/catalog';
import { motion, spectrum } from '@/theme';
import type { MoodLog } from '@/store/types';
import type { DayKey } from '@/utils/date';
import { lastDays } from '@/utils/date';

export type GlobeNode = {
  /** The day this orb opens, i.e. the strongest day in its bucket. */
  day: DayKey;
  /** Every day folded into this orb — 1 for short ranges, more for long ones. */
  span: DayKey[];
  color: string;
  ghost: boolean;
  intensity: number;
  /** Unit vector on the sphere. */
  x: number;
  y: number;
  z: number;
};

/** Evenly-spaced points on a sphere — no clumping at the poles. */
const fibonacciSphere = (n: number) => {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
};

/**
 * Roughly the most orbs we can project per frame on the UI thread and still
 * hold 60fps on an iPhone. Longer ranges fold several days into one orb rather
 * than adding nodes.
 */
export const MAX_NODES = 120;

export const buildGlobeNodes = (
  moods: Record<DayKey, MoodLog>,
  hasEntries: (day: DayKey) => boolean,
  rangeDays: number
): GlobeNode[] => {
  const days = lastDays(rangeDays);
  const step = Math.max(1, Math.ceil(days.length / MAX_NODES));

  const buckets: DayKey[][] = [];
  for (let i = 0; i < days.length; i += step) buckets.push(days.slice(i, i + step));

  const pts = fibonacciSphere(buckets.length);

  return buckets.map((span, i) => {
    // The day that felt the most is the one the orb speaks for.
    let lead: MoodLog | undefined;
    for (const d of span) {
      const m = moods[d];
      if (m && (!lead || m.intensity > lead.intensity)) lead = m;
    }
    const logged = !!lead || span.some(hasEntries);
    return {
      day: lead?.day ?? span[span.length - 1],
      span,
      color: lead ? emotionColor(lead.emotion) : spectrum.neutral,
      ghost: !logged,
      intensity: lead?.intensity ?? 0.5,
      ...pts[i],
    };
  });
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type NodeProps = {
  node: GlobeNode;
  spin: SharedValue<number>;
  tilt: SharedValue<number>;
  bloom: SharedValue<number>;
  radius: number;
  baseSize: number;
  selected: boolean;
  onPress: (day: DayKey) => void;
};

const GlobeNodeView = memo(
  ({ node, spin, tilt, bloom, radius, baseSize, selected, onPress }: NodeProps) => {
    const { x: px, y: py, z: pz, ghost, intensity } = node;

    const animated = useAnimatedStyle(() => {
      'worklet';
      // Yaw about the vertical axis…
      const cy = Math.cos(spin.value);
      const sy = Math.sin(spin.value);
      const x1 = px * cy + pz * sy;
      const z1 = -px * sy + pz * cy;

      // …then pitch, so a drag up/down tips the globe toward you.
      const ct = Math.cos(tilt.value);
      const st = Math.sin(tilt.value);
      const y2 = py * ct - z1 * st;
      const z2 = py * st + z1 * ct;

      // Weak perspective: nearer points sit further out and read larger.
      const persp = 1 / (1 - z2 * 0.36);
      const depth = (z2 + 1) / 2; // 0 = far side, 1 = nearest

      const scale = persp * (0.72 + depth * 0.5) * (1 + bloom.value * 0.06);

      return {
        transform: [
          { translateX: x1 * radius * persp },
          { translateY: y2 * radius * persp },
          { scale },
        ],
        opacity: ghost ? 0.1 + depth * 0.3 : 0.3 + depth * 0.7,
        zIndex: Math.round(depth * 1000),
      };
    });

    const size = baseSize * (ghost ? 0.72 : 0.82 + intensity * 0.38);

    return (
      <AnimatedPressable
        onPress={() => onPress(node.day)}
        hitSlop={4}
        style={[styles.node, { marginLeft: -size / 2, marginTop: -size / 2 }, animated]}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: ghost ? 'rgba(255,255,255,0.6)' : node.color,
            borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
            borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
            shadowColor: ghost ? '#9A90BD' : node.color,
            shadowOffset: { width: 0, height: size * 0.12 },
            shadowOpacity: ghost ? 0.12 : 0.5,
            shadowRadius: size * (ghost ? 0.2 : 0.46),
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: size * 0.14,
              left: size * 0.2,
              width: size * 0.4,
              height: size * 0.3,
              borderRadius: size * 0.2,
              backgroundColor: 'rgba(255,255,255,0.6)',
              transform: [{ rotate: '-18deg' }],
            }}
          />
        </View>
      </AnimatedPressable>
    );
  }
);
GlobeNodeView.displayName = 'GlobeNodeView';

type GlobeProps = {
  nodes: GlobeNode[];
  size: number;
  /** Radians per second of idle drift. */
  idleSpeed?: number;
  selectedDay?: DayKey | null;
  onSelect?: (day: DayKey) => void;
  interactive?: boolean;
  orbSize?: number;
};

/**
 * A sphere of memories you can flick around. Rotation, momentum and projection
 * all live on the UI thread, so it keeps 60fps while the list below scrolls.
 */
export const EmotionGlobe = ({
  nodes,
  size,
  idleSpeed = 0.16,
  selectedDay,
  onSelect,
  interactive = true,
  orbSize,
}: GlobeProps) => {
  const spin = useSharedValue(0);
  const tilt = useSharedValue(-0.18);
  const velocity = useSharedValue(idleSpeed);
  const bloom = useSharedValue(0);
  const dragging = useSharedValue(0);

  const radius = size * 0.4;
  const base = orbSize ?? Math.max(11, size * 0.062);

  useFrameCallback((frame) => {
    'worklet';
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    if (dragging.value === 0) {
      // Ease the flick velocity back down to the idle drift.
      velocity.value += (idleSpeed - velocity.value) * Math.min(1, dt * 1.6);
      spin.value += velocity.value * dt;
      // Let the tilt settle back toward its resting angle.
      tilt.value += (-0.18 - tilt.value) * Math.min(1, dt * 1.4);
    }
  }, true);

  const handleSelect = React.useCallback(
    (day: DayKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSelect?.(day);
    },
    [onSelect]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive)
        .onBegin(() => {
          dragging.value = 1;
          bloom.value = withSpring(1, motion.springSoft);
        })
        .onChange((e) => {
          spin.value -= e.changeX * 0.0072;
          const next = tilt.value + e.changeY * 0.005;
          tilt.value = Math.max(-0.62, Math.min(0.62, next));
        })
        .onFinalize((e) => {
          dragging.value = 0;
          bloom.value = withSpring(0, motion.springSoft);
          const flick = -(e.velocityX ?? 0) * 0.0026;
          velocity.value = Math.max(-7, Math.min(7, flick));
        }),
    [interactive, spin, tilt, velocity, bloom, dragging]
  );

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.32 + bloom.value * 0.2,
    transform: [{ scale: 1 + bloom.value * 0.03 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* diffuse light behind the sphere so orbs on the far side glow through */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: size * 0.78,
              height: size * 0.78,
              borderRadius: size * 0.39,
              backgroundColor: '#FFFFFF',
              shadowColor: '#B9A9E8',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 44,
            },
            haloStyle,
          ]}
        />
        <View style={styles.center}>
          {nodes.map((n) => (
            <GlobeNodeView
              key={n.day}
              node={n}
              spin={spin}
              tilt={tilt}
              bloom={bloom}
              radius={radius}
              baseSize={base}
              selected={selectedDay === n.day}
              onPress={handleSelect}
            />
          ))}
        </View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: { position: 'absolute' },
});
