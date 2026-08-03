import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CaptureRail } from '@/components/Capture';
import { ClayCard, PressableCard, ScriptHeading } from '@/components/Clay';
import { EntryCard } from '@/components/EntryCard';
import { HeroOrb } from '@/components/Orb';
import { Screen, Starfield } from '@/components/Screen';
import { emotionColor, EMOTION_BY_KEY } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import type { CaptureKind } from '@/store/types';
import { clay, palette, radius, space, spectrum, type } from '@/theme';
import { formatLong, greeting, lastDays, todayKey } from '@/utils/date';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { entries, moods, todayMood, streak, profile } = useDiary();

  const tint = todayMood ? emotionColor(todayMood.emotion) : spectrum.confidence;
  const emotion = todayMood ? EMOTION_BY_KEY[todayMood.emotion] : null;
  const orbSize = Math.min(220, width * 0.56);

  const recent = useMemo(() => entries.slice(0, 6), [entries]);

  const week = useMemo(() => {
    return lastDays(7).map((day) => {
      const m = moods[day];
      return { day, color: m ? emotionColor(m.emotion) : null, intensity: m?.intensity ?? 0 };
    });
  }, [moods]);

  const openCompose = (kind: CaptureKind) =>
    router.push({ pathname: '/compose', params: { kind } });

  return (
    <Screen tint={tint}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={type.overline}>{formatLong(todayKey())}</Text>
            <Text style={[type.title, styles.greeting]}>
              {greeting()},{' '}
              <Text style={type.script(30)}>{profile.name}</Text>
            </Text>
          </View>
          <PressableCard onPress={() => router.push('/profile')} style={styles.avatar}>
            <Text style={type.script(22)}>{profile.name.slice(0, 1)}</Text>
          </PressableCard>
        </Animated.View>

        {/* Today's feeling */}
        <Animated.View entering={FadeInDown.delay(70).duration(420)}>
          <PressableCard onPress={() => router.push('/check-in')} style={styles.heroCard}>
            <View style={styles.heroInner}>
              <ScriptHeading
                plain={todayMood ? 'Today feels like' : 'What do you feel'}
                script={todayMood ? emotion?.label : 'today?'}
                size={24}
              />
              <View style={styles.orbWrap}>
                <HeroOrb size={orbSize} color={tint} intensity={todayMood?.intensity ?? 0.55} />
              </View>
              {todayMood ? (
                <Text style={[type.body, styles.heroCaption]}>
                  {todayMood.note?.trim() || emotion?.whisper}
                </Text>
              ) : (
                <Text style={[type.body, styles.heroCaption]}>
                  Take ten seconds. Pick the colour today actually was.
                </Text>
              )}
              <View style={[styles.heroCta, { borderColor: `${tint}44` }]}>
                <Text style={[type.label, { color: palette.ink }]}>
                  {todayMood ? 'Change today' : 'Check in'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={palette.ink} />
              </View>
            </View>
          </PressableCard>
        </Animated.View>

        {/* Streak + week ribbon */}
        <Animated.View entering={FadeInDown.delay(140).duration(420)}>
          <View style={[clay, styles.night]}>
            <Starfield count={26} seed="streak" />
            <View style={styles.nightRow}>
              <View style={styles.nightStat}>
                <Text style={styles.nightValue}>{streak}</Text>
                <Text style={styles.nightLabel}>Day streak</Text>
              </View>
              <View style={styles.nightDivider} />
              <View style={styles.nightStat}>
                <Text style={styles.nightValue}>{Object.keys(moods).length}</Text>
                <Text style={styles.nightLabel}>Days coloured</Text>
              </View>
              <View style={styles.nightDivider} />
              <View style={styles.nightStat}>
                <Text style={styles.nightValue}>{entries.length}</Text>
                <Text style={styles.nightLabel}>Saved</Text>
              </View>
            </View>
            <View style={styles.weekRow}>
              {week.map((d) => (
                <View key={d.day} style={styles.weekCell}>
                  {d.color ? (
                    <View
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 7,
                        backgroundColor: d.color,
                        shadowColor: d.color,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.85,
                        shadowRadius: 7,
                      }}
                    />
                  ) : (
                    <View style={styles.weekEmpty} />
                  )}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Second brain capture */}
        <Animated.View entering={FadeInDown.delay(210).duration(420)}>
          <ClayCard style={styles.captureCard}>
            <View style={styles.sectionHead}>
              <Text style={type.heading}>Second brain</Text>
              <Text style={type.caption}>Anything. It all lands on today.</Text>
            </View>
            <CaptureRail onPick={openCompose} style={{ marginTop: space.md }} />
          </ClayCard>
        </Animated.View>

        {/* Recent */}
        <Animated.View entering={FadeInDown.delay(280).duration(420)} style={styles.recent}>
          <View style={styles.recentHead}>
            <Text style={type.heading}>Lately</Text>
            <PressableCard onPress={() => router.push('/journal')} haptic={false}>
              <Text style={[type.caption, { color: palette.inkSoft }]}>See all</Text>
            </PressableCard>
          </View>

          {recent.length ? (
            recent.map((e, i) => (
              <Animated.View key={e.id} entering={FadeInDown.delay(320 + i * 45).duration(360)}>
                <EntryCard entry={e} onPress={() => router.push(`/entry/${e.id}`)} />
              </Animated.View>
            ))
          ) : (
            <ClayCard style={{ alignItems: 'center' }}>
              <Text style={[type.body, { textAlign: 'center' }]}>
                Nothing saved yet. Drop a thought, a photo, or a link above and it will show up
                here.
              </Text>
            </ClayCard>
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.md, paddingBottom: 120, gap: space.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  greeting: { marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clay,
  },
  heroCard: {
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clay,
  },
  heroInner: { alignItems: 'center', paddingVertical: space.lg, paddingHorizontal: space.lg },
  orbWrap: { marginVertical: space.lg },
  heroCaption: {
    textAlign: 'center',
    fontSize: 14.5,
    maxWidth: 280,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  night: {
    borderRadius: radius.xl,
    backgroundColor: palette.night,
    overflow: 'hidden',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  nightRow: { flexDirection: 'row', alignItems: 'center' },
  nightStat: { flex: 1, alignItems: 'center', gap: 2 },
  nightValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    fontStyle: 'italic',
  },
  nightLabel: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.4 },
  nightDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  weekRow: {
    flexDirection: 'row',
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  weekCell: { flex: 1, alignItems: 'center' },
  weekEmpty: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  captureCard: { borderRadius: radius.xl },
  sectionHead: { gap: 2 },
  recent: { gap: space.sm },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: space.xs,
  },
});
