import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/design/theme';
import { assemblyProgress, buildLinks, fibonacciSphere, project } from './globeMath';
import { motion, radius, space } from '@/design/tokens';
import { emotionColor, emotionDeep } from '@/emotions/palette';
import type { Orb } from '@/store/orb';
import { composition, isBlank } from '@/store/orb';
import type { DayKey } from '@/utils/date';
import { formatShort, todayKey } from '@/utils/date';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type GlobeItem = {
  day: DayKey;
  orb: Orb | null;
  /** Unit vector on the sphere. */
  x: number;
  y: number;
  z: number;
};

/**
 * The most orbs we project per frame and still hold 60fps. Each runs its own
 * worklet, so this is a measured ceiling — longer ranges sample days instead of
 * adding nodes.
 */
export const MAX_NODES = 110;

export const buildGlobe = (days: DayKey[], orbFor: (d: DayKey) => Orb | null): GlobeItem[] => {
  const step = Math.max(1, Math.ceil(days.length / MAX_NODES));
  const sampled: DayKey[] = [];
  for (let i = 0; i < days.length; i += step) {
    const bucket = days.slice(i, i + step);
    sampled.push(bucket.find((d) => !isBlank(orbFor(d))) ?? bucket[bucket.length - 1]);
  }
  const pts = fibonacciSphere(sampled.length);
  return sampled.map((day, i) => ({ day, orb: orbFor(day), ...pts[i] }));
};

/* -------------------------------------------------------------------------- */

type NodeProps = {
  item: GlobeItem;
  index: number;
  count: number;
  spin: SharedValue<number>;
  tilt: SharedValue<number>;
  zoom: SharedValue<number>;
  slideX: SharedValue<number>;
  slideY: SharedValue<number>;
  assembly: SharedValue<number>;
  radiusPx: number;
  baseSize: number;
  isToday: boolean;
  selected: boolean;
  onPress: (day: DayKey) => void;
  onInspect: (day: DayKey) => void;
  label: string;
};

const GlobeNode = memo(
  ({
    item,
    index,
    count,
    spin,
    tilt,
    zoom,
    slideX,
    slideY,
    assembly,
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

    // Where this orb drifts in from at launch — outward along its own bearing.
    const spread = 2.4 + ((index * 37) % 11) / 11;
    const delay = (index / Math.max(1, count)) * 0.42;

    const projected = useAnimatedStyle(() => {
      'worklet';
      const q = project(px, py, pz, spin.value, tilt.value);
      // Each orb eases in from further out, slightly staggered.
      const p = assemblyProgress(assembly.value, delay);
      const dist = spread + (1 - spread) * p;

      return {
        transform: [
          { translateX: q.x * radiusPx * zoom.value * dist + slideX.value },
          { translateY: q.y * radiusPx * zoom.value * dist + slideY.value },
          { scale: q.persp * (0.62 + q.depth * 0.62) * zoom.value * (0.3 + p * 0.7) },
        ],
        // Strong front/back separation, so the cluster reads as a sphere.
        opacity: (0.12 + q.depth * 0.88) * p,
        zIndex: Math.round(q.depth * 1000),
      };
    });

    const blank = isBlank(item.orb);
    const parts = useMemo(() => (item.orb ? composition(item.orb) : []), [item.orb]);
    const size = baseSize * (blank ? 0.5 : 0.9 + Math.min(0.35, parts.length * 0.06));

    const primary = parts[0] ? emotionColor(parts[0].emotion) : c.lineStrong;
    const secondary = parts[1] ? emotionColor(parts[1].emotion) : null;
    const tertiary = parts[2] ? emotionDeep(parts[2].emotion) : null;

    return (
      <Animated.View
        style={[styles.node, { marginLeft: -size / 2, marginTop: -size / 2 }, projected]}
      >
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
              borderColor: blank ? c.lineStrong : isToday ? c.ink : selected ? c.surface : 'transparent',
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
                  backgroundColor: 'rgba(255,255,255,0.45)',
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

/**
 * Every thread in one animated path, rebuilt per frame in a single worklet.
 * One path is far cheaper than a hundred animated lines, and the front and back
 * halves are split so the near threads read brighter.
 */
const Threads = ({
  items,
  links,
  spin,
  tilt,
  zoom,
  slideX,
  slideY,
  assembly,
  size,
  radiusPx,
  front,
  color,
}: {
  items: GlobeItem[];
  links: [number, number][];
  spin: SharedValue<number>;
  tilt: SharedValue<number>;
  zoom: SharedValue<number>;
  slideX: SharedValue<number>;
  slideY: SharedValue<number>;
  assembly: SharedValue<number>;
  size: number;
  radiusPx: number;
  front: boolean;
  color: string;
}) => {
  const xs = useMemo(() => items.map((i) => i.x), [items]);
  const ys = useMemo(() => items.map((i) => i.y), [items]);
  const zs = useMemo(() => items.map((i) => i.z), [items]);
  const flat = useMemo(() => links.flat(), [links]);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const half = size / 2;
    const k = radiusPx * zoom.value;

    let d = '';
    for (let n = 0; n < flat.length; n += 2) {
      const a = project(xs[flat[n]], ys[flat[n]], zs[flat[n]], spin.value, tilt.value);
      const b = project(xs[flat[n + 1]], ys[flat[n + 1]], zs[flat[n + 1]], spin.value, tilt.value);

      // Split the lattice so near threads read brighter than far ones.
      const near = (a.depth + b.depth) / 2 >= 0.5;
      if (near !== front) continue;

      const x1 = half + a.x * k + slideX.value;
      const y1 = half + a.y * k + slideY.value;
      const x2 = half + b.x * k + slideX.value;
      const y2 = half + b.y * k + slideY.value;

      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }

    // Threads only appear once the orbs have arrived.
    const fade = Math.max(0, Math.min(1, (assembly.value - 0.55) / 0.45));
    return { d, strokeOpacity: (front ? 0.5 : 0.2) * fade };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={front ? 0.9 : 0.7}
      fill="none"
      strokeLinecap="round"
    />
  );
};

/* -------------------------------------------------------------------------- */

type GlobeProps = {
  items: GlobeItem[];
  size: number;
  selectedDay?: DayKey | null;
  onSelect?: (day: DayKey) => void;
  onInspect?: (day: DayKey) => void;
  nameOf: (key: string) => string;
  interactive?: boolean;
  orbSize?: number;
};

/**
 * The personal globe.
 *
 * It turns slowly on its own, the way a held object does, and takes a flick
 * with weight. Drag to turn, pinch to come closer, two fingers to slide it
 * around. Threads run between neighbouring days so the whole thing hangs
 * together like strung marbles rather than floating bubbles.
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
  const slideX = useSharedValue(0);
  const slideY = useSharedValue(0);
  const velocity = useSharedValue(0);
  const dragging = useSharedValue(0);
  const assembly = useSharedValue(reduceMotion ? 1 : 0);

  const radiusPx = size * 0.38;
  const base = orbSize ?? Math.max(10, size * 0.058);
  const today = todayKey();

  const links = useMemo(() => buildLinks(items), [items]);

  /** The orbs gather into the sphere on first appearance. */
  useEffect(() => {
    if (reduceMotion) {
      assembly.value = 1;
      return;
    }
    assembly.value = 0;
    assembly.value = withTiming(1, {
      duration: 1700,
      easing: Easing.out(Easing.cubic),
    });
  }, [assembly, reduceMotion, items.length]);

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

  /** A slow turn of its own, plus whatever momentum a flick left behind. */
  const DRIFT = 0.055;

  useFrameCallback((frame) => {
    'worklet';
    if (dragging.value === 1) return;
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    // Momentum bleeds off into the idle drift rather than to a dead stop.
    velocity.value += (DRIFT - velocity.value) * Math.min(1, dt * 1.5);
    spin.value += velocity.value * dt;
  }, true);

  const rotate = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive && !reduceMotion)
        .maxPointers(1)
        .onBegin(() => {
          dragging.value = 1;
          velocity.value = 0;
        })
        .onChange((e) => {
          // Drag right, the globe turns right. Drag down, it tips toward you.
          spin.value += e.changeX * 0.0062;
          tilt.value = Math.max(-0.62, Math.min(0.62, tilt.value - e.changeY * 0.0042));
        })
        .onFinalize((e) => {
          dragging.value = 0;
          velocity.value = Math.max(-6, Math.min(6, (e.velocityX ?? 0) * 0.0021));
        }),
    [interactive, reduceMotion, spin, tilt, velocity, dragging]
  );

  const slide = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive && !reduceMotion)
        .minPointers(2)
        .onChange((e) => {
          const lim = size * 0.22;
          slideX.value = Math.max(-lim, Math.min(lim, slideX.value + e.changeX));
          slideY.value = Math.max(-lim, Math.min(lim, slideY.value + e.changeY));
        })
        .onEnd(() => {
          if (zoom.value <= 1.02) {
            slideX.value = withTiming(0, { duration: motion.screen });
            slideY.value = withTiming(0, { duration: motion.screen });
          }
        }),
    [interactive, reduceMotion, size, slideX, slideY, zoom]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(interactive && !reduceMotion)
        .onChange((e) => {
          zoom.value = Math.max(0.85, Math.min(2.2, zoom.value * e.scaleChange));
        })
        .onEnd(() => {
          if (zoom.value < 1) {
            zoom.value = withTiming(1, { duration: motion.screen });
            slideX.value = withTiming(0, { duration: motion.screen });
            slideY.value = withTiming(0, { duration: motion.screen });
          }
        }),
    [interactive, reduceMotion, zoom, slideX, slideY]
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(rotate, slide, pinch),
    [rotate, slide, pinch]
  );

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
        {/* Threads behind the orbs… */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Threads
            items={items}
            links={links}
            spin={spin}
            tilt={tilt}
            zoom={zoom}
            slideX={slideX}
            slideY={slideY}
            assembly={assembly}
            size={size}
            radiusPx={radiusPx}
            front={false}
            color={c.inkFaint}
          />
        </Svg>

        <View style={styles.centre}>
          {items.map((item, i) => (
            <GlobeNode
              key={item.day}
              item={item}
              index={i}
              count={items.length}
              spin={spin}
              tilt={tilt}
              zoom={zoom}
              slideX={slideX}
              slideY={slideY}
              assembly={assembly}
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

        {/* …and the near ones in front, so the lattice wraps the cluster. */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Threads
            items={items}
            links={links}
            spin={spin}
            tilt={tilt}
            zoom={zoom}
            slideX={slideX}
            slideY={slideY}
            assembly={assembly}
            size={size}
            radiusPx={radiusPx}
            front
            color={c.inkFaint}
          />
        </Svg>
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
