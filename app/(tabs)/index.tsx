import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { EmotionalOrb } from '@/components/EmotionalOrb';
import { OrbGlobe, buildGlobe } from '@/components/OrbGlobe';
import { Paper } from '@/components/Paper';
import { QuietButton, TextAction } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { describeOrb, isBlank } from '@/store/orb';
import { resurface } from '@/insights/observe';
import { formatLong, greeting, lastDays, shiftDays, todayKey } from '@/utils/date';

/**
 * Today.
 *
 * The job of this screen is one thing: colour today. Today's orb is the largest
 * object and the only primary action; the globe sits underneath as context and
 * reward, not as the thing you have to interpret first.
 */
export default function TodayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t, reduceMotion } = useTheme();
  const { orbFor, noteFor, nameOf, loggedDays } = useDiary();

  const today = todayKey();
  const todayOrb = orbFor(today);
  const done = !isBlank(todayOrb);

  const window = Math.max(14, Math.min(180, loggedDays.length + 7));
  const items = useMemo(() => buildGlobe(lastDays(window), orbFor), [orbFor, window]);

  const globeSize = Math.min(width - space.lg * 2, 300);
  const orbSize = Math.min(width * 0.46, 190);

  const yesterday = noteFor(shiftDays(today, -1));
  const memory = useMemo(
    () => resurface({ days: loggedDays, orbFor, noteFor, today }),
    [loggedDays, orbFor, noteFor, today]
  );

  return (
    <Paper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={t('meta', { color: c.inkFaint })} accessibilityRole="header">
            {formatLong(today).toUpperCase()}
          </Text>
          <Text style={[t('title'), styles.greeting]}>{greeting()}</Text>
        </View>

        {/* Today. The largest thing on the page. */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(420)}
          style={styles.todayBlock}
        >
          <Pressable
            onPress={() => router.push('/compose-orb')}
            accessibilityRole="button"
            accessibilityLabel={
              done
                ? `Today: ${describeOrb(todayOrb!, nameOf)} Open to change it.`
                : 'Colour today'
            }
            style={styles.todayTap}
          >
            <EmotionalOrb
              orb={todayOrb}
              size={orbSize}
              placeholder={!done}
              breathing={!done}
            />
          </Pressable>

          <Text style={[t('heading'), styles.question]}>
            {done ? 'Today is kept' : 'How did today feel?'}
          </Text>
          {done ? (
            <Text style={[t('quote', { color: c.inkSoft }), styles.summary]} numberOfLines={2}>
              {describeOrb(todayOrb!, nameOf)}
            </Text>
          ) : null}

          <QuietButton
            label={done ? 'Change today' : 'Colour today'}
            tone="primary"
            onPress={() => router.push('/compose-orb')}
            style={styles.cta}
          />
          <TextAction
            label={done ? 'Open today' : 'Write instead'}
            align="center"
            onPress={() => router.push(`/day/${today}`)}
          />
        </Animated.View>

        {/* Everything kept so far. Context, not the headline. */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(120).duration(420)}
          style={styles.globeBlock}
        >
          <OrbGlobe
            items={items}
            size={globeSize}
            nameOf={nameOf}
            assembleKey={loggedDays.length}
            onSelect={(item) => router.push(`/day/${item.day}`)}
          />
          <Text style={t('caption', { color: c.inkFaint })}>
            {loggedDays.length} {loggedDays.length === 1 ? 'day' : 'days'} kept
          </Text>
        </Animated.View>

        {/* At most one memory, and only when there is a real one. */}
        {memory ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(420)}>
            <Pressable
              onPress={() => router.push(`/day/${memory.day}`)}
              accessibilityRole="button"
              accessibilityLabel={`${memory.label}. ${memory.text}`}
              style={[styles.memory, { borderTopColor: c.line }]}
            >
              <EmotionalOrb orb={orbFor(memory.day)} size={38} glow={false} detail="simple" />
              <View style={{ flex: 1 }}>
                <Text style={t('meta', { color: c.inkFaint })}>{memory.label.toUpperCase()}</Text>
                <Text style={t('body', { color: c.inkSoft })} numberOfLines={2}>
                  {memory.text}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : yesterday.text ? (
          <View style={[styles.memory, { borderTopColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={t('meta', { color: c.inkFaint })}>FROM YESTERDAY</Text>
              <Text style={t('body', { color: c.inkSoft })} numberOfLines={2}>
                {yesterday.text}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xxl },
  header: { gap: space.xs },
  greeting: { marginTop: 2 },
  todayBlock: { alignItems: 'center', marginTop: space.xl },
  todayTap: { padding: space.sm },
  question: { marginTop: space.lg, textAlign: 'center' },
  summary: { marginTop: space.xs, textAlign: 'center', paddingHorizontal: space.md },
  cta: { alignSelf: 'stretch', marginTop: space.lg },
  globeBlock: { alignItems: 'center', marginTop: space.xxl, gap: space.md },
  memory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xxl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
