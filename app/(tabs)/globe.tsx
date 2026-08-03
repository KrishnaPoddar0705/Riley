import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { OrbGlobe, buildGlobe } from '@/components/OrbGlobe';
import { Paper } from '@/components/Paper';
import { DateHeader, NeumorphicControl, Rule, TextAction } from '@/components/Primitives';
import { EmotionalOrb } from '@/components/EmotionalOrb';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { composition, isBlank } from '@/store/orb';
import type { DayKey } from '@/utils/date';
import { formatShort, lastDays, relativeDay } from '@/utils/date';

const RANGES = [
  { days: 31, label: 'This month' },
  { days: 92, label: 'This season' },
  { days: 365, label: 'This year' },
  { days: 1460, label: 'All time' },
] as const;

/**
 * The globe, given the whole page.
 *
 * The time control is a single line of text that opens a sheet — three fat
 * segmented buttons above the object would compete with it.
 */
export default function GlobeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { c, t, reduceMotion } = useTheme();
  const { orbFor, nameOf, loggedDays } = useDiary();

  const [rangeIdx, setRangeIdx] = useState(1);
  const [picking, setPicking] = useState(false);
  const [inspected, setInspected] = useState<DayKey | null>(null);

  const range = RANGES[rangeIdx];
  const items = useMemo(() => buildGlobe(lastDays(range.days), orbFor), [orbFor, range.days]);
  const size = Math.min(width, height * 0.56);

  const lit = items.filter((i) => !isBlank(i.orb)).length;
  const inspectedOrb = inspected ? orbFor(inspected) : null;

  return (
    <Paper padded={false}>
      <View style={styles.head}>
        <DateHeader meta={`${lit} orbs`} />
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`Time range, ${range.label}. Change`}
          style={styles.rangeBtn}
        >
          <Text style={t('label', { color: c.ink })}>{range.label}</Text>
          <Ionicons name="chevron-down" size={14} color={c.inkFaint} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <OrbGlobe
          items={items}
          size={size}
          nameOf={nameOf}
          selectedDay={inspected}
          onSelect={(day) => router.push(`/day/${day}`)}
          onInspect={setInspected}
        />
      </View>

      {/* Long-press readout. Quiet, dismissible, never blocking. */}
      <View style={styles.readoutSlot}>
        {inspected && inspectedOrb && !isBlank(inspectedOrb) ? (
          <Animated.View
            key={inspected}
            entering={reduceMotion ? undefined : FadeIn.duration(200)}
            exiting={reduceMotion ? undefined : FadeOut.duration(160)}
          >
            <Pressable
              onPress={() => router.push(`/day/${inspected}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${relativeDay(inspected)}`}
              style={styles.readout}
            >
              <EmotionalOrb orb={inspectedOrb} size={34} glow={false} />
              <View style={{ flex: 1 }}>
                <Text style={t('label')}>{relativeDay(inspected)}</Text>
                <Text style={t('caption', { color: c.inkSoft })} numberOfLines={1}>
                  {composition(inspectedOrb)
                    .slice(0, 3)
                    .map((p) => `${nameOf(p.emotion)} ${Math.round(p.share * 100)}%`)
                    .join('  ·  ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.inkFaint} />
            </Pressable>
          </Animated.View>
        ) : (
          <Text style={[t('caption', { color: c.inkFaint }), styles.hint]}>
            {reduceMotion ? 'Tap a day to open it' : 'Drag to turn · tap a day to open it'}
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
                    setPicking(false);
                  }}
                  textStyle={
                    i === rangeIdx
                      ? { color: c.ink, fontWeight: '600' }
                      : undefined
                  }
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
  readoutSlot: { minHeight: 74, paddingHorizontal: space.lg, justifyContent: 'center' },
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
