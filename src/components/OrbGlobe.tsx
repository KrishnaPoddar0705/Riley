import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { motion, radius, space } from '@/design/tokens';
import { emotionColor, emotionDeep } from '@/emotions/palette';
import type { Orb } from '@/store/orb';
import { composition, isBlank } from '@/store/orb';
import type { DayKey } from '@/utils/date';
import { formatShort, todayKey } from '@/utils/date';

export type GlobeItem = {
  day: DayKey;
  orb: Orb | null;
  /** Unit vector on the sphere. */
  x: number;
  y: number;
  z: number;
};

/**
 * The most orbs we project per frame and still hold 60fps. Each one runs its own
 * worklet, so this is a real ceiling rather than a guess — longer time ranges
 * sample days instead of adding nodes.
 */
export const MAX_NODES = 110;

/** Evenly spaced points, no clumping at the poles. */
const fibonacci = (n: number) => {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
};

/**
 * Days are laid onto the sphere oldest-to-newest along the spiral, so the globe
 * has a readable grain: today always arrives at the same pole.
 */
export const buildGlobe = (days: DayKey[], orbFor: (d: DayKey) => Orb | null): GlobeItem[] => {
  const step = Math.max(1, Math.ceil(days.length / MAX_NODES));
  const sampled: DayKey[] = [];
  for (let i = 0; i < days.length; i += step) {
    // When sampling, prefer a day that actually has an orb over a blank one.
    const bucket = days.slice(i, i + step);
    sampled.push(bucket.find((d) => !isBlank(orbFor(d))) ?? bucket[bucket.length - 1]);
  }
  const pts = fibonacci(sampled.length);
  return sampled.map((day, i) => ({ day, orb: orbFor(day), ...pts[i] }));
};

/* -------------------------------------------------------------------------- */

type NodeProps = {
  item: GlobeItem;
  spin: SharedValue<number>;
  tilt: SharedValue<number>;
  zoom: SharedValue<number>;
  radiusPx: number;
  baseSize: number;
  isToday: boolean;
  selected: boolean;
  onPress: (day: DayKey) => void;
  onInspect: (day: DayKey) => void;
  label: string;
};

/**
 * A single orb on the sphere. Deliberately plain Views rather than SVG — at
 * globe scale the mixture only needs to read as two or three colours meeting,
 * and a hundred SVG gradient stacks would not hold frame rate.
 */
const GlobeNode = memo(
  ({
    item,
    spin,
    tilt,
    zoom,
    radiusPx,
    baseSize,
    isToday,
    selected,
    onPress,
    onInspect,
    label,
  }: NodeProps) => {
    const { c } = useTheme();
    const { x: px, y: py, z: pz } = item;

    const projected = useAnimatedStyle(() => {
      'worklet';
      const cy = Math.cos(spin.value);
      const sy = Math.sin(spin.value);
      const x1 = px * cy + pz * sy;
      const z1 = -px * sy + pz * cy;

      const ct = Math.cos(tilt.value);
      const st = Math.sin(tilt.value);
      const y2 = py * ct - z1 * st;
      const z2 = py * st + z1 * ct;

      const persp = 1 / (1 - z2 * 0.3);
      const depth = (z2 + 1) / 2;

      return {
        transform: [
          { translateX: x1 * radiusPx * persp * zoom.value },
          { translateY: y2 * radiusPx * persp * zoom.value },
          { scale: persp * (0.78 + depth * 0.34) * zoom.value },
        ],
        // Far side recedes into the paper rather than glowing through it.
        opacity: 0.24 + depth * 0.76,
        zIndex: Math.round(depth * 1000),
      };
    });

    const blank = isBlank(item.orb);
    const parts = useMemo(() => (item.orb ? composition(item.orb) : []), [item.orb]);
    const size = baseSize * (blank ? 0.5 : 0.9 + Math.min(0.35, parts.length * 0.06));

    const primary = parts[0] ? emotionColor(parts[0].emotion) : c.lineStrong;
    const secondary = parts[1] ? emotionColor(parts[1].emotion) : null;
    const tertiary = parts[2] ? emotionDeep(parts[2].emotion) : null;

    return (
      <Animated.View style={[styles.node, { marginLeft: -size / 2, marginTop: -size / 2 }, projected]}>
        <Pressable
          onPress={() => onPress(item.day)}
          onLongPress={() => onInspect(item.day)}
          delayLongPress={320}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: blank ? 'transparent' : primary,
              borderWidth: blank ? 1 : selected || isToday ? 1.5 : 0,
              borderColor: blank
                ? c.lineStrong
                : isToday
                  ? c.ink
                  : selected
                    ? c.surface
                    : 'transparent',
              borderStyle: blank ? 'dashed' : 'solid',
              overflow: 'hidden',
            }}
          >
            {secondary ? (
              <View
                style={{
                  position: 'absolute',
                  right: -size * 0.16,
                  bottom: -size * 0.16,
                  width: size * 0.78,
                  height: size * 0.78,
                  borderRadius: size * 0.39,
                  backgroundColor: secondary,
                  opacity: 0.72,
                }}
              />
            ) : null}
            {tertiary ? (
              <View
                style={{
                  position: 'absolute',
                  left: -size * 0.1,
                  bottom: -size * 0.2,
                  width: size * 0.5,
                  height: size * 0.5,
                  borderRadius: size * 0.25,
                  backgroundColor: tertiary,
                  opacity: 0.5,
                }}
              />
            ) : null}
            {!blank ? (
              <View
                style={{
                  position: 'absolute',
                  top: size * 0.14,
                  left: size * 0.2,
                  width: size * 0.34,
                  height: size * 0.26,
                  borderRadius: size * 0.17,
                  backgroundColor: 'rgba(255,255,255,0.42)',
                }}
              />
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  }
);
GlobeNode.displayName = 'GlobeNode';

/* -------------------------------------------------------------------------- */

type GlobeProps = {
  items: GlobeItem[];
  size: number;
  selectedDay?: DayKey | null;
  onSelect?: (day: DayKey) => void;
  onInspect?: (day: DayKey) => void;
  nameOf: (key: string) => string;
  /** Small globes on Today are not draggable; the full Globe tab is. */
  interactive?: boolean;
  orbSize?: number;
};

/**
 * The personal globe.
 *
 * At rest it is still — no idle drift, no particles. It moves because the user
 * moved it, and then it settles under its own weight. Rotation, momentum and
 * the 3D projection all run in worklets on the UI thread, so it stays smooth
 * while the page scrolls beneath it.
 */
export const OrbGlobe = ({
  items,
  size,
  selectedDay,
  onSelect,
  onInspect,
  nameOf,
  interactive = true,
  orbSize,
}: GlobeProps) => {
  const { c, reduceMotion } = useTheme();
  const spin = useSharedValue(0.4);
  const tilt = useSharedValue(-0.14);
  const zoom = useSharedValue(1);
  const velocity = useSharedValue(0);
  const dragging = useSharedValue(0);

  const radiusPx = size * 0.38;
  const base = orbSize ?? Math.max(10, size * 0.058);
  const today = todayKey();

  const describe = useCallback(
    (item: GlobeItem) => {
      const when = item.day === today ? 'Today' : formatShort(item.day);
      if (isBlank(item.orb)) return `${when}, no orb yet`;
      const parts = composition(item.orb!)
        .slice(0, 3)
        .map((p) => `${Math.round(p.share * 100)} percent ${nameOf(p.emotion).toLowerCase()}`);
      return `${when}, ${parts.join(', ')}`;
    },
    [nameOf, today]
  );

  const select = useCallback(
    (day: DayKey) => {
      Haptics.selectionAsync().catch(() => {});
      onSelect?.(day);
    },
    [onSelect]
  );

  const inspect = useCallback(
    (day: DayKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onInspect?.(day);
    },
    [onInspect]
  );

  // Momentum only. No ambient rotation — the globe is meant to sit still.
  useFrameCallback((frame) => {
    'worklet';
    if (dragging.value === 1) return;
    const v = velocity.value;
    if (Math.abs(v) < 0.0006) {
      if (v !== 0) velocity.value = 0;
      return;
    }
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    spin.value += v * dt;
    // Heavy, unhurried decay: comes to rest in roughly a second and a half.
    velocity.value = v * Math.pow(0.06, dt);
  }, true);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive && !reduceMotion)
        .onBegin(() => {
          dragging.value = 1;
          velocity.value = 0;
        })
        .onChange((e) => {
          spin.value -= e.changeX * 0.0062;
          tilt.value = Math.max(-0.5, Math.min(0.5, tilt.value + e.changeY * 0.0042));
        })
        .onFinalize((e) => {
          dragging.value = 0;
          velocity.value = Math.max(-5, Math.min(5, -(e.velocityX ?? 0) * 0.0021));
        }),
    [interactive, reduceMotion, spin, tilt, velocity, dragging]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(interactive && !reduceMotion)
        .onChange((e) => {
          // Deliberately shallow: this is a nudge closer, not a zoom control.
          zoom.value = Math.max(0.92, Math.min(1.22, zoom.value * (1 + (e.scaleChange - 1) * 0.5)));
        })
        .onEnd(() => {
          if (zoom.value < 1.02) zoom.value = withTiming(1, { duration: motion.screen });
        }),
    [interactive, reduceMotion, zoom]
  );

  const gesture = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);

  /* Reduce Motion / low-power fallback: the same days, laid flat and still. */
  if (reduceMotion) {
    return (
      <FlatGlobe
        items={items}
        size={size}
        today={today}
        selectedDay={selectedDay}
        onSelect={select}
        onInspect={inspect}
        describe={describe}
      />
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={`Your globe, ${items.filter((i) => !isBlank(i.orb)).length} orbs`}
      >
        <View style={styles.centre}>
          {items.map((item) => (
            <GlobeNode
              key={item.day}
              item={item}
              spin={spin}
              tilt={tilt}
              zoom={zoom}
              radiusPx={radiusPx}
              baseSize={base}
              isToday={item.day === today}
              selected={selectedDay === item.day}
              onPress={select}
              onInspect={inspect}
              label={describe(item)}
            />
          ))}
        </View>
      </View>
    </GestureDetector>
  );
};

/** Static, scrollable grid used when the OS asks for reduced motion. */
const FlatGlobe = ({
  items,
  size,
  today,
  selectedDay,
  onSelect,
  onInspect,
  describe,
}: {
  items: GlobeItem[];
  size: number;
  today: DayKey;
  selectedDay?: DayKey | null;
  onSelect: (d: DayKey) => void;
  onInspect: (d: DayKey) => void;
  describe: (i: GlobeItem) => string;
}) => {
  const { c, t } = useTheme();
  const cell = Math.max(30, Math.floor(size / 7));

  return (
    <View style={{ width: size }}>
      <ScrollView
        contentContainerStyle={styles.flatGrid}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: size }}
      >
        {items.map((item) => {
          const parts = item.orb ? composition(item.orb) : [];
          const blank = isBlank(item.orb);
          const d = cell - 10;
          return (
            <Pressable
              key={item.day}
              onPress={() => onSelect(item.day)}
              onLongPress={() => onInspect(item.day)}
              accessibilityRole="button"
              accessibilityLabel={describe(item)}
              style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  backgroundColor: blank ? 'transparent' : emotionColor(parts[0]?.emotion),
                  borderWidth: blank ? 1 : item.day === today || selectedDay === item.day ? 1.5 : 0,
                  borderColor: blank ? c.lineStrong : c.ink,
                  borderStyle: blank ? 'dashed' : 'solid',
                  overflow: 'hidden',
                }}
              >
                {parts[1] ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: -d * 0.14,
                      bottom: -d * 0.14,
                      width: d * 0.74,
                      height: d * 0.74,
                      borderRadius: d * 0.37,
                      backgroundColor: emotionColor(parts[1].emotion),
                      opacity: 0.72,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[t('caption', { color: c.inkFaint }), styles.flatNote]}>
        Laid flat because Reduce Motion is on.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  centre: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: { position: 'absolute' },
  flatGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  flatNote: { textAlign: 'center', marginTop: space.md },
});
