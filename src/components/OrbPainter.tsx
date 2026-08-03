import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { MIN_TARGET, radius, space } from '@/design/tokens';
import { EMOTIONS, EmotionKey, emotionColor } from '@/emotions/palette';
import type { Orb, OrbStop } from '@/store/orb';
import { composition, MAX_STOPS, makeStop, nextPlacement } from '@/store/orb';
import { clamp } from '@/utils/id';
import { EmotionalOrb } from './EmotionalOrb';
import { IconButton, NeumorphicControl } from './Primitives';

type Props = {
  orb: Orb;
  onChange: (next: Orb) => void;
  size: number;
  nameOf: (key: EmotionKey) => string;
  /** Selected pigment. Lifted so the parent can show its name alongside. */
  active: EmotionKey;
  onActiveChange: (k: EmotionKey) => void;
};

/**
 * Where the day gets made.
 *
 * Touching the face drops the selected pigment where you touched; dragging
 * moves it; holding deepens it. Everything the gestures do is also reachable
 * from the visible controls underneath, so nothing here is gesture-only.
 */
export const OrbPainter = ({ orb, onChange, size, nameOf, active, onActiveChange }: Props) => {
  const { c, t, reduceMotion } = useTheme();
  const [history, setHistory] = useState<Orb[]>([]);
  const [future, setFuture] = useState<Orb[]>([]);
  const [listMode, setListMode] = useState(false);
  const draggingId = useRef<string | null>(null);

  const commit = useCallback(
    (next: Orb, remember = true) => {
      if (remember) {
        setHistory((h) => [...h.slice(-24), orb]);
        setFuture([]);
      }
      onChange(next);
    },
    [orb, onChange]
  );

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [orb, ...f].slice(0, 24));
      onChange(prev);
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
    if (!orb.stops.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    commit({ ...orb, stops: [] });
  };

  /** Nearest existing stop to a touch, if it is close enough to mean it. */
  const stopNear = useCallback(
    (x: number, y: number) => {
      let best: OrbStop | null = null;
      let bestD = 0.34;
      for (const s of orb.stops) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    },
    [orb.stops]
  );

  const placeAt = useCallback(
    (x: number, y: number) => {
      const near = stopNear(x, y);
      if (near && near.emotion === active) {
        draggingId.current = near.id;
        return;
      }
      if (orb.stops.length >= MAX_STOPS) {
        // Full: repaint the nearest stop rather than silently doing nothing.
        if (near) {
          draggingId.current = near.id;
          commit({
            ...orb,
            stops: orb.stops.map((s) => (s.id === near.id ? { ...s, emotion: active } : s)),
          });
        }
        return;
      }
      const stop = makeStop(active, x, y);
      draggingId.current = stop.id;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      commit({ ...orb, stops: [...orb.stops, stop] });
    },
    [active, orb, commit, stopNear]
  );

  const moveActive = useCallback(
    (x: number, y: number) => {
      const id = draggingId.current;
      if (!id) return;
      onChange({
        ...orb,
        stops: orb.stops.map((s) => (s.id === id ? { ...s, x: clamp(x, -1, 1), y: clamp(y, -1, 1) } : s)),
      });
    },
    [orb, onChange]
  );

  const intensifyActive = useCallback(() => {
    const id = draggingId.current;
    if (!id) return;
    onChange({
      ...orb,
      stops: orb.stops.map((s) =>
        s.id === id ? { ...s, weight: clamp(s.weight + 0.06, 0.12, 1) } : s
      ),
    });
  }, [orb, onChange]);

  const endStroke = useCallback(() => {
    draggingId.current = null;
  }, []);

  /* ----- gestures ------------------------------------------------------- */

  const half = size / 2;

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHold = useCallback(() => {
    if (holdTimer.current) return;
    holdTimer.current = setInterval(() => {
      intensifyActive();
      Haptics.selectionAsync().catch(() => {});
    }, 160);
  }, [intensifyActive]);
  const stopHold = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!listMode)
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          let x = (e.x - half) / half;
          let y = (e.y - half) / half;
          const d = Math.sqrt(x * x + y * y);
          // Clamp to the face so pigment never lands outside the sphere.
          if (d > 0.94) {
            x = (x / d) * 0.94;
            y = (y / d) * 0.94;
          }
          runOnJS(placeAt)(x, y);
        })
        .onChange((e) => {
          'worklet';
          let x = (e.x - half) / half;
          let y = (e.y - half) / half;
          const d = Math.sqrt(x * x + y * y);
          if (d > 0.94) {
            x = (x / d) * 0.94;
            y = (y / d) * 0.94;
          }
          runOnJS(moveActive)(x, y);
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(endStroke)();
          runOnJS(stopHold)();
        }),
    [listMode, placeAt, moveActive, endStroke, stopHold, half]
  );

  const hold = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(!listMode)
        .minDuration(280)
        .onStart(() => {
          'worklet';
          runOnJS(startHold)();
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(stopHold)();
        }),
    [listMode, startHold, stopHold]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(!listMode)
        .onChange((e) => {
          'worklet';
          runOnJS(spreadBy)(e.scaleChange);
        }),
    [listMode]
  );

  function spreadBy(scaleChange: number) {
    const id = draggingId.current ?? orb.stops[orb.stops.length - 1]?.id;
    if (!id) return;
    onChange({
      ...orb,
      stops: orb.stops.map((s) =>
        s.id === id ? { ...s, spread: clamp(s.spread * scaleChange, 0.25, 1) } : s
      ),
    });
  }

  const gesture = useMemo(() => Gesture.Simultaneous(pan, hold, pinch), [pan, hold, pinch]);

  /* ----- stepper controls (the non-gesture path) ------------------------ */

  const parts = useMemo(() => composition(orb), [orb]);

  const addStop = (key: EmotionKey) => {
    if (orb.stops.length >= MAX_STOPS) return;
    const p = nextPlacement(orb, `${orb.day}:${key}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    commit({ ...orb, stops: [...orb.stops, makeStop(key, p.x, p.y)] });
  };

  const adjust = (key: EmotionKey, delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const touched = orb.stops.filter((s) => s.emotion === key);
    if (!touched.length) {
      if (delta > 0) addStop(key);
      return;
    }
    const next = orb.stops
      .map((s) => (s.emotion === key ? { ...s, weight: clamp(s.weight + delta, 0, 1) } : s))
      .filter((s) => s.weight > 0.05);
    commit({ ...orb, stops: next });
  };

  const toggleDepth = (key: EmotionKey) => {
    Haptics.selectionAsync().catch(() => {});
    commit({
      ...orb,
      stops: orb.stops.map((s) => (s.emotion === key ? { ...s, depth: !s.depth } : s)),
    });
  };

  return (
    <View>
      {/* The canvas */}
      <View style={styles.stage}>
        <GestureDetector gesture={gesture}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Today's orb canvas"
            accessibilityHint="Touch to place the selected colour. Drag to move it. Hold to deepen it. All of this is also available from the controls below."
            style={{ width: size, height: size }}
          >
            <EmotionalOrb orb={orb} size={size} placeholder={!orb.stops.length} breathing={!orb.stops.length} />
          </View>
        </GestureDetector>
      </View>

      {/* Undo / redo / reset / input mode */}
      <View style={styles.toolRow}>
        <IconButton label="Undo" onPress={undo} style={{ opacity: history.length ? 1 : 0.3 }}>
          <Ionicons name="arrow-undo-outline" size={19} color={c.inkSoft} />
        </IconButton>
        <IconButton label="Redo" onPress={redo} style={{ opacity: future.length ? 1 : 0.3 }}>
          <Ionicons name="arrow-redo-outline" size={19} color={c.inkSoft} />
        </IconButton>
        <IconButton label="Clear the orb" onPress={reset} style={{ opacity: orb.stops.length ? 1 : 0.3 }}>
          <Ionicons name="refresh-outline" size={19} color={c.inkSoft} />
        </IconButton>
        <View style={{ flex: 1 }} />
        <IconButton
          label={listMode ? 'Switch to painting' : 'Switch to controls'}
          onPress={() => {
            setListMode((v) => !v);
            Haptics.selectionAsync().catch(() => {});
          }}
        >
          <Ionicons name={listMode ? 'color-palette-outline' : 'options-outline'} size={19} color={c.inkSoft} />
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
            used={orb.stops.some((s) => s.emotion === e.key)}
            onPress={() => {
              onActiveChange(e.key);
              Haptics.selectionAsync().catch(() => {});
              if (listMode) addStop(e.key);
            }}
          />
        ))}
      </ScrollView>

      {/* Composition — visible controls for everything the gestures do */}
      {parts.length ? (
        <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(240)} style={styles.mixture}>
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
                    label={isDeep ? `Bring ${nameOf(p.emotion)} to the surface` : `Sink ${nameOf(p.emotion)} to the centre`}
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
          {listMode ? 'Choose a colour to begin.' : 'Touch the orb to leave a colour.'}
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
      <View
        style={[
          styles.usedDot,
          { backgroundColor: used ? c.ink : 'transparent' },
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.lg,
  },
  wells: { gap: space.sm, paddingVertical: space.sm, paddingRight: space.lg },
  wellTap: { alignItems: 'center' },
  well: { alignItems: 'center', justifyContent: 'center' },
  usedDot: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  mixture: { marginTop: space.md },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET },
  mixDot: { width: 12, height: 12, borderRadius: 6 },
  mixName: { flex: 1 },
  mixControls: { flexDirection: 'row', alignItems: 'center' },
  hint: { marginTop: space.md, textAlign: 'center' },
});
