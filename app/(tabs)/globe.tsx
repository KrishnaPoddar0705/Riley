import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { EmotionalOrb } from '@/components/EmotionalOrb';
import { AGGREGATE_ABOVE, GlobeItem, OrbGlobe, buildGlobe } from '@/components/OrbGlobe';
import { Paper } from '@/components/Paper';
import { DateHeader, NeumorphicControl, Rule, TextAction } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { describeOrb, isBlank } from '@/store/orb';
import type { DayKey } from '@/utils/date';
import { lastDays, relativeDay } from '@/utils/date';

const RANGES = [
  { days: 31, label: 'This month' },
  { days: 92, label: 'This season' },
  { days: 365, label: 'This year' },
  { days: 3650, label: 'All time' },
] as const;

/**
 * The globe, given the whole page.
 *
 * Days wind around it in order, so turning it moves through time. Past a year
 * it collapses into month forms you can open, rather than shrinking days into
 * specks nobody can tap.
 */
export default function GlobeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { c, t, reduceMotion } = useTheme();
  const { orbFor, nameOf, loggedDays } = useDiary();

  const [rangeIdx, setRangeIdx] = useState(1);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<GlobeItem | null>(null);
  /** Set when a month form has been opened into its days. */
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const range = RANGES[rangeIdx];

  const items = useMemo(() => {
    if (openMonth) {
      const all = lastDays(RANGES[RANGES.length - 1].days).filter((d) => d.startsWith(openMonth));
      return buildGlobe(all, orbFor);
    }
    return buildGlobe(lastDays(range.days), orbFor);
  }, [orbFor, range.days, openMonth]);

  const size = Math.min(width, height * 0.52);
  const lit = items.filter((i) => !isBlank(i.orb)).length;
  const aggregated = !openMonth && range.days > AGGREGATE_ABOVE;

  const onSelect = (item: GlobeItem) => {
    if (item.monthLabel) {
      // Opening a month zooms into its days.
      setOpenMonth(item.day.slice(0, 7));
      setSelected(null);
      return;
    }
    setSelected((s) => (s?.day === item.day ? null : item));
  };

  return (
    <Paper padded={false}>
      <View style={styles.head}>
        <DateHeader
          meta={
            openMonth
              ? `${items.filter((i) => !isBlank(i.orb)).length} days kept`
              : aggregated
                ? `${items.length} months`
                : `${lit} days kept`
          }
        />
        {openMonth ? (
          <Pressable
            onPress={() => setOpenMonth(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to all months"
            style={styles.rangeBtn}
          >
            <Ionicons name="chevron-back" size={14} color={c.inkFaint} />
            <Text style={t('label', { color: c.ink })}>All months</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={`Time range, ${range.label}. Change`}
            style={styles.rangeBtn}
          >
            <Text style={t('label', { color: c.ink })}>{range.label}</Text>
            <Ionicons name="chevron-down" size={14} color={c.inkFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.stage}>
        <OrbGlobe
          items={items}
          size={size}
          nameOf={nameOf}
          selectedDay={selected?.day}
          assembleKey={`${range.days}:${openMonth ?? ''}`}
          onSelect={onSelect}
        />
      </View>

      <View style={styles.readoutSlot}>
        {selected && selected.orb && !isBlank(selected.orb) ? (
          <Animated.View
            key={selected.day}
            entering={reduceMotion ? undefined : FadeIn.duration(200)}
            exiting={reduceMotion ? undefined : FadeOut.duration(150)}
          >
            <Pressable
              onPress={() => router.push(`/day/${selected.day}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${relativeDay(selected.day)}`}
              style={styles.readout}
            >
              <EmotionalOrb orb={selected.orb} size={38} glow={false} />
              <View style={{ flex: 1 }}>
                <Text style={t('label')}>{relativeDay(selected.day)}</Text>
                <Text style={t('caption', { color: c.inkSoft })} numberOfLines={2}>
                  {describeOrb(selected.orb, nameOf)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.inkFaint} />
            </Pressable>
          </Animated.View>
        ) : (
          <Text style={[t('caption', { color: c.inkFaint }), styles.hint]}>
            {reduceMotion
              ? 'Tap a day to open it'
              : aggregated
                ? 'Tap a month to open it'
                : 'Drag to turn · tap a day'}
          </Text>
        )}
      </View>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.scrim} onPress={() => setPicking(false)}>
          <NeumorphicControl variant="raised" level="floating" round="lg" style={styles.sheet}>
            {RANGES.map((r, i) => (
              <View key={r.days}>
                {i > 0 ? <Rule /> : null}
                <TextAction
                  label={r.label}
                  align="center"
                  onPress={() => {
                    setRangeIdx(i);
                    setSelected(null);
                    setPicking(false);
                  }}
                  textStyle={i === rangeIdx ? { color: c.ink, fontWeight: '600' } : undefined}
                  style={styles.sheetRow}
                />
              </View>
            ))}
          </NeumorphicControl>
        </Pressable>
      </Modal>
    </Paper>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  rangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readoutSlot: { minHeight: 78, paddingHorizontal: space.lg, justifyContent: 'center' },
  readout: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  hint: { textAlign: 'center' },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,18,14,0.28)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: space.lg,
  },
  sheet: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.xl },
  sheetRow: { alignItems: 'center', paddingVertical: space.md },
});
