import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DateHeader, TextAction } from '@/components/Primitives';
import { EmotionalOrb } from '@/components/EmotionalOrb';
import { OrbGlobe, buildGlobe } from '@/components/OrbGlobe';
import { Paper } from '@/components/Paper';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { composition, isBlank } from '@/store/orb';
import { formatLong, greeting, lastDays, shiftDays, todayKey } from '@/utils/date';

/**
 * Today.
 *
 * One question, one object, one action. The globe is the page — everything
 * else is a caption to it.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { orbFor, noteFor, nameOf, loggedDays, reduceMotionSafe } = useTodayData();
  const { c, t, reduceMotion } = useTheme();

  const today = todayKey();
  const todayOrb = orbFor(today);
  const done = !isBlank(todayOrb);

  const items = useMemo(
    () => buildGlobe(lastDays(90), orbFor),
    [orbFor]
  );

  const globeSize = Math.min(width - space.lg * 2, height * 0.46);

  const yesterdayNote = noteFor(shiftDays(today, -1));
  const monthCount = useMemo(() => {
    const prefix = today.slice(0, 7);
    return loggedDays.filter((d) => d.startsWith(prefix)).length;
  }, [loggedDays, today]);

  const composed = done ? composition(todayOrb!).slice(0, 2) : [];

  return (
    <Paper>
      <View style={styles.header}>
        <DateHeader meta={formatLong(today)} />
        <Text style={[t('title'), styles.greeting]}>{greeting()}</Text>
        {yesterdayNote ? (
          <Text style={t('quote', { color: c.inkSoft })} numberOfLines={2}>
            “{yesterdayNote}”
          </Text>
        ) : null}
      </View>

      <View style={styles.stage}>
        <OrbGlobe
          items={items}
          size={globeSize}
          nameOf={nameOf}
          onSelect={(day) => router.push(`/day/${day}`)}
          onInspect={(day) => router.push(`/day/${day}`)}
        />
      </View>

      {/* The primary action is the orb itself. */}
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(400)} style={styles.action}>
        <Pressable
          onPress={() => router.push('/compose-orb')}
          accessibilityRole="button"
          accessibilityLabel={
            done
              ? `Today's orb: ${composed.map((p) => nameOf(p.emotion)).join(' and ')}. Open to change it.`
              : "Create today's orb"
          }
          style={styles.actionInner}
        >
          <EmotionalOrb
            orb={todayOrb}
            size={92}
            placeholder={!done}
            breathing={!done && !reduceMotionSafe}
          />
          <View style={styles.actionText}>
            <Text style={t('heading')}>{done ? 'Today is shaped' : "Shape today's orb"}</Text>
            <Text style={t('caption', { color: c.inkSoft })} numberOfLines={1}>
              {done
                ? composed.map((p) => nameOf(p.emotion)).join(' · ')
                : 'What did today feel like?'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      <View style={styles.footer}>
        <TextAction
          label={done ? 'Continue writing' : 'Skip to writing'}
          onPress={() => router.push(`/day/${today}`)}
        />
        <Text style={t('caption', { color: c.inkFaint })}>
          {monthCount} this month
        </Text>
      </View>
    </Paper>
  );
}

/** Small indirection so the screen body stays readable. */
const useTodayData = () => {
  const { orbFor, noteFor, nameOf, loggedDays } = useDiary();
  const { reduceMotion } = useTheme();
  return { orbFor, noteFor, nameOf, loggedDays, reduceMotionSafe: reduceMotion };
};

const styles = StyleSheet.create({
  header: { paddingTop: space.md, gap: space.xs },
  greeting: { marginTop: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  action: { marginBottom: space.sm },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  actionText: { flex: 1, gap: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.sm,
  },
});
