import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS } from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { MIN_TARGET, radius, space } from '@/design/tokens';
import { EMOTIONS, EmotionKey, emotionColor } from '@/emotions/palette';
import type { BrushKind, Orb, OrbStroke } from '@/store/orb';
import {
  BRUSH_FLOWS,
  BRUSH_SIZES,
  composition,
  MAX_POINTS,
  MAX_STOPS,
  MAX_STROKES,
  makeStop,
  makeStroke,
  nextPlacement,
  strokesOf,
} from '@/store/orb';
import { clamp } from '@/utils/id';
import { EmotionalOrb } from './EmotionalOrb';
import { IconButton, NeumorphicControl } from './Primitives';

type Props = {
  orb: Orb;
  onChange: (next: Orb) => void;
  size: number;
  nameOf: (key: EmotionKey) => string;
  active: EmotionKey;
  onActiveChange: (k: EmotionKey) => void;
};

const TOOLS: { kind: BrushKind; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { kind: 'brush', icon: 'brush-outline', label: 'Brush' },
  { kind: 'airbrush', icon: 'cloud-outline', label: 'Airbrush' },
  { kind: 'eraser', icon: 'backspace-outline', label: 'Eraser' },
];

/** Only record a point once the finger has actually travelled. */
const MIN_STEP = 0.028;

/**
 * The canvas.
 *
 * Drawing on the face lays down a mark you can see building under the finger.
 * The brush carries colour, the airbrush shades in soft passes you can build up
 * a layer at a time, and the eraser takes paint back off. Everything the
 * gestures do is also reachable from the controls underneath.
 */
export const OrbPainter = ({ orb, onChange, size, nameOf, active, onActiveChange }: Props) => {
  const { c, t, reduceMotion } = useTheme();

  const [history, setHistory] = useState<Orb[]>([]);
  const [future, setFuture] = useState<Orb[]>([]);
  const [tool, setTool] = useState<BrushKind>('brush');
  const [sizeIdx, setSizeIdx] = useState(1);
  const [flowIdx, setFlowIdx] = useState(1);
  const [listMode, setListMode] = useState(false);

  /** The mark currently under the finger. Kept out of the orb until released. */
  const [live, setLive] = useState<OrbStroke | null>(null);
  const liveRef = useRef<OrbStroke | null>(null);

  const remember = useCallback(() => {
    setHistory((h) => [...h.slice(-24), orb]);
    setFuture([]);
  }, [orb]);

  const commit = useCallback(
    (next: Orb) => {
      remember();
      onChange(next);
    },
    [remember, onChange]
  );

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setFuture((f) => [orb, ...f].slice(0, 24));
      onChange(h[h.length - 1]);
      Haptics.selectionAsync().catch(() => {});
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      setHistory((h) => [...h, orb]);
      onChange(f[0]);
      Haptics.selectionAsync().catch(() => {});
      return f.slice(1);
    });
  };

  const reset = () => {
    if (!orb.stops.length && !strokesOf(orb).length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    commit({ ...orb, stops: [], strokes: [] });
  };

  /* ----- drawing -------------------------------------------------------- */

  const beginStroke = useCallback(
    (x: number, y: number) => {
      if (strokesOf(orb).length >= MAX_STROKES) return;
      const s = makeStroke(active, tool, BRUSH_SIZES[sizeIdx], BRUSH_FLOWS[flowIdx], { x, y });
      liveRef.current = s;
      setLive(s);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [orb, active, tool, sizeIdx, flowIdx]
  );

  const extendStroke = useCallback((x: number, y: number) => {
    const s = liveRef.current;
    if (!s) return;
    const last = s.pts[s.pts.length - 1];
    if (Math.hypot(x - last.x, y - last.y) < MIN_STEP) return;
    if (s.pts.length >= MAX_POINTS) return;
    const next = { ...s, pts: [...s.pts, { x, y }] };
    liveRef.current = next;
    setLive(next);
  }, []);

  const endStroke = useCallback(() => {
    const s = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (!s) return;
    remember();
    onChange({ ...orb, strokes: [...strokesOf(orb), s] });
  }, [orb, onChange, remember]);

  const half = size / 2;

  const draw = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!listMode)
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => {
          'worklet';
          let x = (e.x - half) / half;
          let y = (e.y - half) / half;
          const d = Math.sqrt(x * x + y * y);
          // Keep pigment on the face.
          if (d > 0.95) {
            x = (x / d) * 0.95;
            y = (y / d) * 0.95;
          }
          runOnJS(beginStroke)(x, y);
        })
        .onChange((e) => {
          'worklet';
          let x = (e.x - half) / half;
          let y = (e.y - half) / half;
          const d = Math.sqrt(x * x + y * y);
          if (d > 0.95) {
            x = (x / d) * 0.95;
            y = (y / d) * 0.95;
          }
          runOnJS(extendStroke)(x, y);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(endStroke)();
        }),
    [listMode, half, beginStroke, extendStroke, endStroke]
  );

  /* ----- washes, via the visible controls -------------------------------- */

  const parts = useMemo(() => composition(orb), [orb]);

  const addWash = (key: EmotionKey) => {
    if (orb.stops.length >= MAX_STOPS) return;
    const p = nextPlacement(orb, `${orb.day}:${key}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    commit({ ...orb, stops: [...orb.stops, makeStop(key, p.x, p.y)] });
  };

  const adjust = (key: EmotionKey, delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const hasWash = orb.stops.some((s) => s.emotion === key);
    if (!hasWash) {
      if (delta > 0) addWash(key);
      else {
        // Only strokes of this colour: lighten them instead.
        commit({
          ...orb,
          strokes: strokesOf(orb)
            .map((s) => (s.emotion === key ? { ...s, flow: clamp(s.flow - 0.2, 0, 1) } : s))
            .filter((s) => s.flow > 0.05),
        });
      }
      return;
    }
    commit({
      ...orb,
      stops: orb.stops
        .map((s) => (s.emotion === key ? { ...s, weight: clamp(s.weight + delta, 0, 1) } : s))
        .filter((s) => s.weight > 0.05),
    });
  };

  const toggleDepth = (key: EmotionKey) => {
    Haptics.selectionAsync().catch(() => {});
    commit({
      ...orb,
      stops: orb.stops.map((s) => (s.emotion === key ? { ...s, depth: !s.depth } : s)),
    });
  };

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;
  const dirty = orb.stops.length > 0 || strokesOf(orb).length > 0;

  return (
    <View>
      <View style={styles.stage}>
        <GestureDetector gesture={draw}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Orb canvas"
            accessibilityHint="Draw on the orb to paint with the selected colour. Every tool is also available from the controls below."
            style={{ width: size, height: size }}
          >
            <EmotionalOrb
              orb={orb}
              live={live}
              size={size}
              placeholder={!dirty && !live}
              breathing={!dirty && !live}
            />
          </View>
        </GestureDetector>
      </View>

      {/* Tools */}
      <View style={styles.toolRow}>
        {TOOLS.map((tl) => {
          const on = tool === tl.kind && !listMode;
          return (
            <Pressable
              key={tl.kind}
              onPress={() => {
                setTool(tl.kind);
                setListMode(false);
                Haptics.selectionAsync().catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tl.label}
              style={[
                styles.tool,
                { borderColor: on ? c.ink : 'transparent', backgroundColor: on ? c.accentSoft : 'transparent' },
              ]}
            >
              <Ionicons name={tl.icon} size={17} color={on ? c.ink : c.inkFaint} />
              <Text style={t('caption', { color: on ? c.ink : c.inkFaint })}>{tl.label}</Text>
            </Pressable>
          );
        })}

        <View style={{ flex: 1 }} />

        <IconButton label="Undo" onPress={undo} style={{ opacity: canUndo ? 1 : 0.28 }}>
          <Ionicons name="arrow-undo-outline" size={18} color={c.inkSoft} />
        </IconButton>
        <IconButton label="Redo" onPress={redo} style={{ opacity: canRedo ? 1 : 0.28 }}>
          <Ionicons name="arrow-redo-outline" size={18} color={c.inkSoft} />
        </IconButton>
        <IconButton label="Clear the orb" onPress={reset} style={{ opacity: dirty ? 1 : 0.28 }}>
          <Ionicons name="refresh-outline" size={18} color={c.inkSoft} />
        </IconButton>
      </View>

      {/* Brush size and flow */}
      <View style={styles.brushRow}>
        <View style={styles.brushGroup} accessibilityLabel="Brush size">
          {BRUSH_SIZES.map((s, i) => {
            const on = sizeIdx === i;
            const d = 8 + i * 5;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  setSizeIdx(i);
                  Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={['Fine', 'Medium', 'Broad'][i] + ' brush'}
                style={styles.brushTap}
              >
                <View
                  style={{
                    width: d,
                    height: d,
                    borderRadius: d / 2,
                    backgroundColor: on ? c.ink : c.lineStrong,
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: c.line }]} />

        <View style={styles.brushGroup} accessibilityLabel="Paint flow">
          {BRUSH_FLOWS.map((f, i) => {
            const on = flowIdx === i;
            return (
              <Pressable
                key={f}
                onPress={() => {
                  setFlowIdx(i);
                  Haptics.selectionAsync().catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={['Light', 'Medium', 'Full'][i] + ' flow'}
                style={styles.brushTap}
              >
                <View
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 8,
                    backgroundColor: emotionColor(active),
                    opacity: f,
                    borderWidth: on ? 1.5 : 0,
                    borderColor: c.ink,
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        <IconButton
          label={listMode ? 'Switch to drawing' : 'Switch to controls'}
          onPress={() => {
            setListMode((v) => !v);
            Haptics.selectionAsync().catch(() => {});
          }}
        >
          <Ionicons
            name={listMode ? 'brush-outline' : 'options-outline'}
            size={18}
            color={listMode ? c.ink : c.inkFaint}
          />
        </IconButton>
      </View>

      {/* Pigments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.wells}
        accessibilityLabel="Colour palette"
      >
        {EMOTIONS.map((e) => (
          <EmotionColourWell
            key={e.key}
            color={e.color}
            name={nameOf(e.key)}
            selected={active === e.key}
            used={
              orb.stops.some((s) => s.emotion === e.key) ||
              strokesOf(orb).some((s) => s.emotion === e.key && s.kind !== 'eraser')
            }
            onPress={() => {
              onActiveChange(e.key);
              Haptics.selectionAsync().catch(() => {});
              if (listMode) addWash(e.key);
            }}
          />
        ))}
      </ScrollView>

      {/* Composition */}
      {parts.length ? (
        <Animated.View
          layout={reduceMotion ? undefined : LinearTransition.duration(240)}
          style={styles.mixture}
        >
          {parts.map((p) => {
            const isDeep = orb.stops.some((s) => s.emotion === p.emotion && s.depth);
            return (
              <Animated.View
                key={p.emotion}
                entering={reduceMotion ? undefined : FadeIn.duration(200)}
                exiting={reduceMotion ? undefined : FadeOut.duration(160)}
                style={styles.mixRow}
              >
                <View style={[styles.mixDot, { backgroundColor: emotionColor(p.emotion) }]} />
                <Text style={[t('label'), styles.mixName]} numberOfLines={1}>
                  {nameOf(p.emotion)}
                </Text>
                <Text style={t('caption', { color: c.inkFaint })}>{Math.round(p.share * 100)}%</Text>
                <View style={styles.mixControls}>
                  <IconButton label={`Less ${nameOf(p.emotion)}`} onPress={() => adjust(p.emotion, -0.15)}>
                    <Ionicons name="remove" size={17} color={c.inkSoft} />
                  </IconButton>
                  <IconButton label={`More ${nameOf(p.emotion)}`} onPress={() => adjust(p.emotion, 0.15)}>
                    <Ionicons name="add" size={17} color={c.inkSoft} />
                  </IconButton>
                  <IconButton
                    label={
                      isDeep
                        ? `Bring ${nameOf(p.emotion)} to the surface`
                        : `Sink ${nameOf(p.emotion)} into the centre`
                    }
                    onPress={() => toggleDepth(p.emotion)}
                  >
                    <Ionicons
                      name={isDeep ? 'contract-outline' : 'expand-outline'}
                      size={16}
                      color={isDeep ? c.accent : c.inkFaint}
                    />
                  </IconButton>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>
      ) : (
        <Text style={[t('caption', { color: c.inkFaint }), styles.hint]}>
          {listMode ? 'Choose a colour to add a wash.' : 'Draw on the orb.'}
        </Text>
      )}
    </View>
  );
};

/* -------------------------------------------------------------------------- */

export const EmotionColourWell = ({
  color,
  name,
  selected,
  used,
  onPress,
  size = 38,
}: {
  color: string;
  name: string;
  selected?: boolean;
  used?: boolean;
  onPress?: () => void;
  size?: number;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected: !!selected }}
      hitSlop={6}
      style={styles.wellTap}
    >
      <NeumorphicControl
        variant={selected ? 'inset' : 'raised'}
        level="soft"
        round="pill"
        style={[
          styles.well,
          {
            width: size + 10,
            height: size + 10,
            borderRadius: (size + 10) / 2,
            borderColor: selected ? c.ink : c.lift,
            borderWidth: selected ? 1.5 : 1,
          },
        ]}
      >
        <View
          style={{
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
            backgroundColor: color,
          }}
        />
      </NeumorphicControl>
      {/* Never colour alone: a used pigment is also marked with a dot. */}
      <View style={[styles.usedDot, { backgroundColor: used ? c.ink : 'transparent' }]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.lg },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  brushRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  brushGroup: { flexDirection: 'row', alignItems: 'center' },
  brushTap: {
    minWidth: 34,
    minHeight: MIN_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: StyleSheet.hairlineWidth, height: 20 },
  wells: { gap: space.sm, paddingVertical: space.sm, paddingRight: space.lg },
  wellTap: { alignItems: 'center' },
  well: { alignItems: 'center', justifyContent: 'center' },
  usedDot: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  mixture: { marginTop: space.sm },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET },
  mixDot: { width: 12, height: 12, borderRadius: 6 },
  mixName: { flex: 1 },
  mixControls: { flexDirection: 'row', alignItems: 'center' },
  hint: { marginTop: space.md, textAlign: 'center' },
});
