import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ClayCard, GlassButton, ScriptHeading } from '@/components/Clay';
import { Screen } from '@/components/Screen';
import { emotionColor, emotionLabel } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import { clayTight, palette, radius, space, spectrum, type } from '@/theme';
import {
  fromDayKey,
  monthMatrix,
  monthTitle,
  todayKey,
  WEEKDAYS_MIN,
} from '@/utils/date';

export default function CalendarScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { moods, entriesFor, todayMood } = useDiary();

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const tint = todayMood ? emotionColor(todayMood.emotion) : spectrum.confidence;
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);

  const gridWidth = width - space.md * 2 - space.md * 2;
  const cellSize = Math.floor(gridWidth / 7);

  const monthStats = useMemo(() => {
    const logged = cells.filter((c) => c && moods[c]).length;
    const counts = new Map<string, number>();
    for (const c of cells) {
      if (!c) continue;
      const m = moods[c];
      if (m) counts.set(m.emotion, (counts.get(m.emotion) ?? 0) + 1);
    }
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return { logged, top: top ? { key: top[0], count: top[1] } : null };
  }, [cells, moods]);

  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const isFuture =
    cursor.year > now.getFullYear() ||
    (cursor.year === now.getFullYear() && cursor.month >= now.getMonth());

  return (
    <Screen tint={tint}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.head}>
          <ScriptHeading plain="Every day," script="in colour" size={25} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(420)}>
          <ClayCard style={styles.card}>
            <View style={styles.monthRow}>
              <GlassButton size={36} onPress={() => step(-1)}>
                <Ionicons name="chevron-back" size={17} color={palette.ink} />
              </GlassButton>
              <Text style={[type.heading, { fontSize: 18 }]}>
                {monthTitle(cursor.year, cursor.month)}
              </Text>
              <GlassButton
                size={36}
                onPress={() => {
                  if (!isFuture) step(1);
                }}
                style={{ opacity: isFuture ? 0.35 : 1 }}
              >
                <Ionicons name="chevron-forward" size={17} color={palette.ink} />
              </GlassButton>
            </View>

            <View style={styles.weekHead}>
              {WEEKDAYS_MIN.map((d, i) => (
                <View key={i} style={{ width: cellSize, alignItems: 'center' }}>
                  <Text style={type.caption}>{d}</Text>
                </View>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={`pad-${i}`} style={{ width: cellSize, height: cellSize + 6 }} />;
                const mood = moods[day];
                const color = mood ? emotionColor(mood.emotion) : null;
                const hasEntries = entriesFor(day).length > 0;
                const isToday = day === todayKey();
                const dayNum = fromDayKey(day).getDate();
                const orb = Math.round(cellSize * 0.58);

                return (
                  <Pressable
                    key={day}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      router.push(`/day/${day}`);
                    }}
                    style={{ width: cellSize, height: cellSize + 6, alignItems: 'center' }}
                  >
                    <Animated.View entering={FadeIn.delay(Math.min(i * 8, 260)).duration(280)}>
                      <View
                        style={[
                          styles.cellOrb,
                          {
                            width: orb,
                            height: orb,
                            borderRadius: orb / 2,
                            backgroundColor: color ?? 'transparent',
                            borderWidth: color ? 0 : 1,
                            borderColor: hasEntries ? palette.inkGhost : 'rgba(160,150,190,0.22)',
                            shadowColor: color ?? 'transparent',
                            shadowOpacity: color ? 0.55 : 0,
                            shadowRadius: color ? orb * 0.4 : 0,
                            opacity: mood ? 0.55 + mood.intensity * 0.45 : 1,
                          },
                        ]}
                      >
                        {color ? <View style={[styles.cellSpec, { width: orb * 0.36, height: orb * 0.26 }]} /> : null}
                        {!color && hasEntries ? <View style={styles.cellTick} /> : null}
                      </View>
                      {isToday ? <View style={[styles.todayRing, { width: orb + 8, height: orb + 8, borderRadius: (orb + 8) / 2, top: -4, left: -4 }]} /> : null}
                    </Animated.View>
                    <Text
                      style={[
                        type.caption,
                        { marginTop: 3, fontSize: 10 },
                        isToday && { color: palette.ink, fontWeight: '700' },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ClayCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(420)} style={styles.statsRow}>
          <View style={[clayTight, styles.stat]}>
            <Text style={styles.statValue}>{monthStats.logged}</Text>
            <Text style={type.caption}>days logged</Text>
          </View>
          <View style={[clayTight, styles.stat]}>
            {monthStats.top ? (
              <>
                <View style={styles.statTop}>
                  <View
                    style={[
                      styles.statDot,
                      {
                        backgroundColor: emotionColor(monthStats.top.key),
                        shadowColor: emotionColor(monthStats.top.key),
                      },
                    ]}
                  />
                  <Text style={[type.heading, { fontSize: 15 }]}>
                    {emotionLabel(monthStats.top.key)}
                  </Text>
                </View>
                <Text style={type.caption}>most days this month</Text>
              </>
            ) : (
              <>
                <Text style={styles.statValue}>—</Text>
                <Text style={type.caption}>nothing logged yet</Text>
              </>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.md, paddingBottom: 120, gap: space.md },
  head: { alignItems: 'center', paddingTop: space.sm },
  card: { borderRadius: radius.xl },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  weekHead: { flexDirection: 'row', marginBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
  },
  cellSpec: {
    position: 'absolute',
    top: '16%',
    left: '20%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
    transform: [{ rotate: '-18deg' }],
  },
  cellTick: { width: 4, height: 4, borderRadius: 2, backgroundColor: palette.inkGhost },
  todayRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(120,105,160,0.35)',
  },
  statsRow: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    gap: 2,
  },
  statValue: { ...type.heading, fontSize: 22, fontStyle: 'italic' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  statDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
});
