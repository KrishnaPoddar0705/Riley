import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ClayCard, GlassButton, PressableCard, ScriptHeading } from '@/components/Clay';
import { EntryCard } from '@/components/EntryCard';
import { HeroOrb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { emotionColor, emotionLabel, EMOTION_BY_KEY } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import { clayTight, palette, radius, space, spectrum, type } from '@/theme';
import { formatLong, relativeDay, todayKey } from '@/utils/date';

export default function DayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { day: raw } = useLocalSearchParams<{ day: string }>();
  const day = raw ?? todayKey();
  const { moods, entriesFor } = useDiary();

  const mood = moods[day];
  const entries = entriesFor(day).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const tint = mood ? emotionColor(mood.emotion) : spectrum.neutral;
  const orbSize = Math.min(width * 0.44, 180);

  return (
    <Screen tint={tint} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <GlassButton size={40} onPress={() => router.back()}>
          <Ionicons name="close" size={18} color={palette.ink} />
        </GlassButton>
        <Text style={type.label}>{relativeDay(day)}</Text>
        <GlassButton
          size={40}
          onPress={() => router.push({ pathname: '/check-in', params: { day } })}
        >
          <Ionicons name="color-palette-outline" size={18} color={palette.ink} />
        </GlassButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.hero}>
          {mood ? (
            <>
              <HeroOrb size={orbSize} color={tint} intensity={mood.intensity} />
              <ScriptHeading plain="This day was" script={emotionLabel(mood.emotion)} size={24} />
              <Text style={type.caption}>
                {Math.round(mood.intensity * 100)}% · {mood.valence} · {formatLong(day)}
              </Text>
              {mood.also.length ? (
                <View style={styles.alsoRow}>
                  {mood.also.map((k) => (
                    <View key={k} style={[clayTight, styles.alsoChip]}>
                      <View
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 5,
                          backgroundColor: emotionColor(k),
                        }}
                      />
                      <Text style={type.caption}>{emotionLabel(k)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <HeroOrb size={orbSize} color={spectrum.neutral} intensity={0.3} />
              <ScriptHeading plain="No colour on" script={formatLong(day)} size={22} />
              <PressableCard
                onPress={() => router.push({ pathname: '/check-in', params: { day } })}
                style={styles.cta}
              >
                <Ionicons name="add" size={16} color={palette.ink} />
                <Text style={[type.label, { color: palette.ink }]}>Add how it felt</Text>
              </PressableCard>
            </>
          )}
        </Animated.View>

        {mood?.note?.trim() ? (
          <Animated.View entering={FadeInDown.delay(80).duration(380)}>
            <ClayCard style={styles.noteCard}>
              <Text style={[type.overline, { marginBottom: 6 }]}>In your words</Text>
              <Text style={[type.body, { color: palette.ink, fontSize: 15.5 }]}>{mood.note}</Text>
            </ClayCard>
          </Animated.View>
        ) : mood ? (
          <Animated.View entering={FadeInDown.delay(80).duration(380)}>
            <ClayCard style={styles.noteCard}>
              <Text style={[type.body, { fontStyle: 'italic' }]}>
                {EMOTION_BY_KEY[mood.emotion]?.whisper}
              </Text>
            </ClayCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(140).duration(380)} style={styles.entriesBlock}>
          <View style={styles.entriesHead}>
            <Text style={type.heading}>Saved this day</Text>
            <PressableCard
              onPress={() => router.push({ pathname: '/compose', params: { day } })}
              style={styles.addSmall}
            >
              <Ionicons name="add" size={16} color={palette.ink} />
            </PressableCard>
          </View>

          {entries.length ? (
            entries.map((e, i) => (
              <Animated.View key={e.id} entering={FadeInDown.delay(180 + i * 50).duration(340)}>
                <EntryCard entry={e} onPress={() => router.push(`/entry/${e.id}`)} />
              </Animated.View>
            ))
          ) : (
            <ClayCard style={{ alignItems: 'center' }}>
              <Text style={[type.body, { textAlign: 'center' }]}>
                Nothing was saved on this day.
              </Text>
            </ClayCard>
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  content: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.md },
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.lg },
  alsoRow: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  alsoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  noteCard: { borderRadius: radius.lg },
  entriesBlock: { gap: space.sm },
  entriesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  addSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clayTight,
  },
});
