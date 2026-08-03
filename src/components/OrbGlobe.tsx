import * as Haptics from 'expo-haptics';
import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { motion, space } from '@/design/tokens';
import { emotionColor, emotionDeep } from '@/emotions/palette';
import type { Orb } from '@/store/orb';
import { composition, isBlank } from '@/store/orb';
import type { DayKey } from '@/utils/date';
import { formatShort, fromDayKey, todayKey } from '@/utils/date';
import { ARC_THRESHOLD, assemblyProgress, layoutFor, project } from './globeMath';

export type GlobeItem = {
  /** The day this position opens. */
  day: DayKey;
  orb: Orb | null;
  /** Set when the node stands for a whole month rather than one day. */
  monthLabel?: string;
  /** How many coloured days it represents. 1 for a single day. */
  count: number;
  x: number;
  y: number;
  z: number;
};

/**
 * The most positions we project per frame and still hold 60fps. Each runs its
 * own worklet, so this is a measured ceiling. Beyond it the globe aggregates
 * into months rather than shrinking days into unreachable specks.
 */
export const MAX_NODES = 110;

/** Above this many days, one node stands for one month. */
export const AGGREGATE_ABOVE = 120;

/**
 * Builds the positions for a stretch of time.
 *
 * Three regimes, one rule: a fortnight sits on an arc, a season winds around a
 * chronological spiral, and a year or more collapses into month forms you can
 * open. Days are never made smaller than a fingertip to fit more in.
 */
export const buildGlobe = (
  days: DayKey[],
  orbFor: (d: DayKey) => Orb | null
): GlobeItem[] => {
  const aggregate = days.length > AGGREGATE_ABOVE;

  if (!aggregate) {
    const pts = layoutFor(days.length);
    return days.map((day, i) => ({ day, orb: orbFor(day), count: 1, ...pts[i] }));
  }

  // One node per month, standing for whichever day in it felt strongest.
  const months = new Map<string, DayKey[]>();
  for (const d of days) {
    const key = d.slice(0, 7);
    const list = months.get(key);
    if (list) list.push(d);
    else months.set(key, [d]);
  }

  const entries = Array.from(months.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const pts = layoutFor(entries.length);

  return entries.map(([key, list], i) => {
    const coloured = list.filter((d) => !isBlank(orbFor(d)));
    // The month wears the colour of its most present day.
    const lead =
      coloured
        .map((d) => ({ d, orb: orbFor(d)! }))
        .sort(
          (a, b) =>
            (composition(b.orb)[0]?.share ?? 0) * b.orb.feelings.length -
            (composition(a.orb)[0]?.share ?? 0) * a.orb.feelings.length
        )[0] ?? null;
    const date = fromDayKey(`${key}-01`);
    return {
      day: lead?.d ?? list[list.length - 1],
      orb: lead?.orb ?? null,
      monthLabel: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      count: coloured.length,
      ...pts[i],
    };
  });
};

/* -------------------------------------------------------------------------- */

type NodeProps = {
  item: GlobeItem;
  index: number;
  count: number;
  spin: SharedValue<number>;
  tilt: SharedValue<number>;
  zoom: SharedValue<number>;
  assembly: SharedValue<number>;
  radiusPx: number;
  baseSize: number;
  isToday: boolean;
  selected: boolean;
  onPress: (item: GlobeItem) => void;
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
    assembly,
    radiusPx,
    baseSize,
    isToday,
    selected,
    onPress,
    label,
  }: NodeProps) => {
    const { c } = useTheme();
    const { x: px, y: py, z: pz } = item;

    const spread = 2.3 + ((index * 37) % 11) / 11;
    const delay = (index / Math.max(1, count)) * 0.42;

    const projected = useAnimatedStyle(() => {
      'worklet';
      const q = project(px, py, pz, spin.value, tilt.value);
      const p = assemblyProgress(assembly.value, delay);
      const dist = spread + (1 - spread) * p;
      const grow = selected ? 1.35 : 1;

      return {
        transform: [
          { translateX: q.x * radiusPx * zoom.value * dist },
          { translateY: q.y * radiusPx * zoom.value * dist },
          { scale: q.persp * (0.6 + q.depth * 0.66) * zoom.value * grow * (0.3 + p * 0.7) },
        ],
        opacity: (0.14 + q.depth * 0.86) * p,
        zIndex: Math.round(q.depth * 1000) + (selected ? 2000 : 0),
      };
    });

    const blank = isBlank(item.orb);
    const parts = useMemo(() => (item.orb ? composition(item.orb) : []), [item.orb]);

    // Months read a little larger than days; blank days stay small and quiet.
    const size =
      baseSize *
      (blank ? 0.46 : item.monthLabel ? 1.35 : 0.92 + Math.min(0.3, parts.length * 0.07));

    const primary = parts[0] ? emotionColor(parts[0].emotion) : c.lineStrong;
    const secondary = parts[1] ? emotionColor(parts[1].emotion) : null;
    const tertiary = parts[2] ? emotionDeep(parts[2].emotion) : null;

    return (
      <Animated.View style={[styles.node, { marginLeft: -size / 2, marginTop: -size / 2 }, projected]}>
        <Pressable
          onPress={() => onPress(item)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: blank ? 'transparent' : primary,
              borderWidth: blank ? 1 : isToday || selected ? 1.5 : 0,
              borderColor: blank ? c.lineStrong : isToday ? c.ink : selected ? c.surface : 'transparent',
              borderStyle: blank ? 'dashed' : 'solid',
              overflow: 'hidden',
            }}
          >
            {secondary ? (
              <View
                style={{
                  position: 'absolute',
                  right: -size * 0.18,
                  bottom: -size * 0.18,
                  width: size * 0.8,
                  height: size * 0.8,
                  borderRadius: size * 0.4,
                  backgroundColor: secondary,
                  opacity: 0.7,
                }}
              />
            ) : null}
            {tertiary ? (
              <View
                style={{
                  position: 'absolute',
                  left: -size * 0.12,
                  bottom: -size * 0.22,
                  width: size * 0.52,
                  height: size * 0.52,
                  borderRadius: size * 0.26,
                  backgroundColor: tertiary,
                  opacity: 0.48,
                }}
              />
            ) : null}
            {!blank ? (
              <View
                style={{
                  position: 'absolute',
                  top: size * 0.15,
                  left: size * 0.21,
                  width: size * 0.32,
                  height: size * 0.24,
                  borderRadius: size * 0.16,
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
  onSelect?: (item: GlobeItem) => void;
  nameOf: (key: string) => string;
  interactive?: boolean;
  orbSize?: number;
  /** Replays the gathering animation when this changes. */
  assembleKey?: string | number;
};

/**
 * The globe.
 *
 * Days are wound around it in order, so turning it moves through time. It
 * drifts slowly on its own, takes a flick with weight, and settles. There is
 * nothing drawn between the orbs — the structure is the time, not a graph.
 */
export const OrbGlobe = ({
  items,
  size,
  selectedDay,
  onSelect,
  nameOf,
  interactive = true,
  orbSize,
  assembleKey,
}: GlobeProps) => {
  const { c, t, reduceMotion } = useTheme();

  const spin = useSharedValue(0.3);
  const tilt = useSharedValue(-0.12);
  const zoom = useSharedValue(1);
  const velocity = useSharedValue(0);
  const dragging = useSharedValue(0);
  const assembly = useSharedValue(reduceMotion ? 1 : 0);

  const radiusPx = size * 0.38;
  const base = orbSize ?? Math.max(11, size * (items.length <= ARC_THRESHOLD ? 0.11 : 0.06));
  const today = todayKey();

  useEffect(() => {
    if (reduceMotion) {
      assembly.value = 1;
      return;
    }
    assembly.value = 0;
    assembly.value = withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) });
  }, [assembly, reduceMotion, assembleKey, items.length]);

  const describe = useCallback(
    (item: GlobeItem) => {
      if (item.monthLabel) {
        return `${item.monthLabel}, ${item.count} ${item.count === 1 ? 'day' : 'days'} kept`;
      }
      const when = item.day === today ? 'Today' : formatShort(item.day);
      if (isBlank(item.orb)) return `${when}, not coloured`;
      const parts = composition(item.orb!)
        .slice(0, 2)
        .map((p) => nameOf(p.emotion).toLowerCase());
      return `${when}, ${parts.join(' and ')}`;
    },
    [nameOf, today]
  );

  const select = useCallback(
    (item: GlobeItem) => {
      Haptics.selectionAsync().catch(() => {});
      onSelect?.(item);
    },
    [onSelect]
  );

  /** A slow turn of its own, plus whatever momentum a flick left behind. */
  const DRIFT = 0.05;

  useFrameCallback((frame) => {
    'worklet';
    if (dragging.value === 1) return;
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
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
          // Drag right, it turns right. Drag down, it tips toward you.
          spin.value += e.changeX * 0.0062;
          tilt.value = Math.max(-0.6, Math.min(0.6, tilt.value - e.changeY * 0.0042));
        })
        .onFinalize((e) => {
          dragging.value = 0;
          velocity.value = Math.max(-6, Math.min(6, (e.velocityX ?? 0) * 0.0021));
        }),
    [interactive, reduceMotion, spin, tilt, velocity, dragging]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(interactive && !reduceMotion)
        .onChange((e) => {
          zoom.value = Math.max(0.9, Math.min(1.8, zoom.value * e.scaleChange));
        })
        .onEnd(() => {
          if (zoom.value < 1) zoom.value = withTiming(1, { duration: motion.screen });
        }),
    [interactive, reduceMotion, zoom]
  );

  /** Double tap returns it to rest. */
  const recentre = useMemo(
    () =>
      Gesture.Tap()
        .enabled(interactive && !reduceMotion)
        .numberOfTaps(2)
        .onEnd(() => {
          zoom.value = withTiming(1, { duration: motion.screen });
          tilt.value = withTiming(-0.12, { duration: motion.screen });
          velocity.value = 0;
        }),
    [interactive, reduceMotion, zoom, tilt, velocity]
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(rotate, pinch, recentre),
    [rotate, pinch, recentre]
  );

  if (reduceMotion) {
    return (
      <FlatGlobe
        items={items}
        size={size}
        today={today}
        selectedDay={selectedDay}
        onSelect={select}
        describe={describe}
      />
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={`Your days, ${items.filter((i) => !isBlank(i.orb)).length} coloured`}
      >
        <View style={styles.centre}>
          {items.map((item, i) => (
            <GlobeNode
              key={item.monthLabel ?? item.day}
              item={item}
              index={i}
              count={items.length}
              spin={spin}
              tilt={tilt}
              zoom={zoom}
              assembly={assembly}
              radiusPx={radiusPx}
              baseSize={base}
              isToday={item.day === today && !item.monthLabel}
              selected={selectedDay === item.day}
              onPress={select}
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
  describe,
}: {
  items: GlobeItem[];
  size: number;
  today: DayKey;
  selectedDay?: DayKey | null;
  onSelect: (i: GlobeItem) => void;
  describe: (i: GlobeItem) => string;
}) => {
  const { c, t } = useTheme();
  const cell = Math.max(34, Math.floor(size / 6));

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
          const d = cell - 12;
          return (
            <Pressable
              key={item.monthLabel ?? item.day}
              onPress={() => onSelect(item)}
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
                      right: -d * 0.16,
                      bottom: -d * 0.16,
                      width: d * 0.76,
                      height: d * 0.76,
                      borderRadius: d * 0.38,
                      backgroundColor: emotionColor(parts[1].emotion),
                      opacity: 0.7,
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
