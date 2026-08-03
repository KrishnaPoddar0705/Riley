import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { Pill, PressableCard, ScriptHeading } from '@/components/Clay';
import { buildGlobeNodes, EmotionGlobe } from '@/components/EmotionGlobe';
import { Screen } from '@/components/Screen';
import { emotionColor, emotionLabel, EMOTION_BY_KEY } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import { clay, clayTight, palette, radius, space, spectrum, type } from '@/theme';
import { formatShort, lastDays, relativeDay } from '@/utils/date';
import type { DayKey } from '@/utils/date';

const RANGES = [
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: 'A year' },
] as const;

export default function GlobeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { moods, entriesFor, todayMood } = useDiary();
  const [range, setRange] = useState<number>(90);
  const [selected, setSelected] = useState<DayKey | null>(null);

  const nodes = useMemo(
    () => buildGlobeNodes(moods, (d) => entriesFor(d).length > 0, range),
    [moods, entriesFor, range]
  );

  const globeSize = Math.min(width * 0.92, 400);

  /** Top emotions across the window, as a little colour ledger. */
  const ledger = useMemo(() => {
    const counts = new Map<string, number>();
    for (const day of lastDays(range)) {
      const m = moods[day];
      if (!m) continue;
      counts.set(m.emotion, (counts.get(m.emotion) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, n]) => ({
        key,
        label: emotionLabel(key),
        color: emotionColor(key),
        share: Math.round((n / total) * 100),
        count: n,
      }));
  }, [moods, range]);

  const loggedCount = nodes.filter((n) => !n.ghost).length;
  const selectedMood = selected ? moods[selected] : undefined;
  const tint = todayMood ? emotionColor(todayMood.emotion) : spectrum.confidence;

  return (
    <Screen tint={tint}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // The globe swallows horizontal drags; vertical scroll still works.
        scrollEventThrottle={16}
      >
        <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
          <ScriptHeading plain="Everything you felt" script="in orbit" size={25} />
          <Text style={[type.caption, styles.subhead]}>
            {loggedCount} of {nodes.length} orbs lit · drag to spin
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(80).duration(420)} style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pill
              key={r.value}
              label={r.label}
              active={range === r.value}
              onPress={() => {
                setSelected(null);
                setRange(r.value);
              }}
            />
          ))}
        </Animated.View>

        <View style={styles.globeWrap}>
          <EmotionGlobe
            nodes={nodes}
            size={globeSize}
            selectedDay={selected}
            onSelect={(d) => setSelected((prev) => (prev === d ? null : d))}
          />
        </View>

        {/* Selected orb readout */}
        {selectedMood ? (
          <Animated.View
            key={selectedMood.day}
            entering={FadeInDown.duration(280)}
            exiting={FadeOut.duration(140)}
          >
            <PressableCard
              onPress={() => router.push(`/day/${selectedMood.day}`)}
              style={
                {
                  ...clay,
                  ...styles.readout,
                  shadowColor: `${emotionColor(selectedMood.emotion)}`,
                } as never
              }
            >
              <View
                style={[
                  styles.readoutOrb,
                  {
                    backgroundColor: emotionColor(selectedMood.emotion),
                    shadowColor: emotionColor(selectedMood.emotion),
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={type.caption}>{relativeDay(selectedMood.day)}</Text>
                <Text style={[type.heading, { fontSize: 17 }]}>
                  {emotionLabel(selectedMood.emotion)}
                </Text>
                <Text numberOfLines={2} style={[type.body, { fontSize: 13.5, marginTop: 2 }]}>
                  {selectedMood.note?.trim() ||
                    EMOTION_BY_KEY[selectedMood.emotion]?.whisper ||
                    'No note on this one.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
            </PressableCard>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(280)}>
            <View style={[clayTight, styles.hint]}>
              <Ionicons name="hand-left-outline" size={15} color={palette.inkFaint} />
              <Text style={type.caption}>Tap any orb to open that day</Text>
            </View>
          </Animated.View>
        )}

        {/* Colour ledger */}
        {ledger.length ? (
          <Animated.View entering={FadeInDown.delay(160).duration(420)} style={styles.ledger}>
            <Text style={[type.overline, { marginBottom: space.sm }]}>Most of the time</Text>
            {ledger.map((l) => (
              <View key={l.key} style={styles.ledgerRow}>
                <View
                  style={[styles.ledgerDot, { backgroundColor: l.color, shadowColor: l.color }]}
                />
                <Text style={[type.label, { color: palette.ink, width: 92 }]}>{l.label}</Text>
                <View style={styles.ledgerTrack}>
                  <View
                    style={[
                      styles.ledgerFill,
                      { width: `${Math.max(5, l.share)}%`, backgroundColor: l.color },
                    ]}
                  />
                </View>
                <Text style={[type.caption, { width: 36, textAlign: 'right' }]}>{l.share}%</Text>
              </View>
            ))}
            <Text style={[type.caption, { marginTop: space.sm }]}>
              {formatShort(lastDays(range)[0])} — today
            </Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.md, paddingBottom: 120, gap: space.md },
  header: { alignItems: 'center', paddingTop: space.sm },
  subhead: { marginTop: 4 },
  rangeRow: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  globeWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: space.xs },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  readoutOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  ledger: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clayTight,
  },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 },
  ledgerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  ledgerTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(120,105,160,0.12)',
    overflow: 'hidden',
  },
  ledgerFill: { height: 6, borderRadius: 3 },
});
