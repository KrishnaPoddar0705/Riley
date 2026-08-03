import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { EmotionalOrb } from '@/components/EmotionalOrb';
import { Paper } from '@/components/Paper';
import { QuietButton, TextAction } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { makeFeeling, Orb } from '@/store/orb';
import { todayKey } from '@/utils/date';

const demo = (feelings: Orb['feelings'], clarity = 0.7): Orb => ({
  day: 'demo',
  feelings,
  clarity,
  updatedAt: '',
});

/**
 * Three screens, no account, no questionnaire.
 *
 * Each one demonstrates the idea with a live orb rather than describing it —
 * the flat orb becomes layered, then something is placed underneath it, then
 * the days gather. Then the user makes their own.
 */
export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t, reduceMotion } = useTheme();
  const { updateSettings } = useDiary();

  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState(0);
  const size = Math.min(width * 0.56, 230);

  // Screen one shows the transformation the product is actually about.
  useEffect(() => {
    if (step !== 0 || reduceMotion) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 2), 2600);
    return () => clearInterval(id);
  }, [step, reduceMotion]);

  const flat = demo([makeFeeling('joy', 'surface', 0.95, 'a')]);
  const layered = demo(
    [
      makeFeeling('joy', 'surface', 0.8, 'b'),
      makeFeeling('fatigue', 'core', 0.55, 'c'),
      makeFeeling('hope', 'moment', 0.3, 'd'),
    ],
    0.45
  );
  const withUnder = demo([
    makeFeeling('calm', 'surface', 0.85, 'e'),
    makeFeeling('anxiety', 'core', 0.5, 'f'),
  ]);

  const SCREENS = [
    {
      title: 'A day is rarely one feeling.',
      body: 'Most days are a mixture. Happy but tired. Proud with something anxious underneath.',
      orb: phase === 0 && !reduceMotion ? flat : layered,
    },
    {
      title: 'Colour what was on the surface — and what was underneath.',
      body: 'You choose the feelings and where they sat. The orb is made for you.',
      orb: withUnder,
    },
    {
      title: 'Keep one orb for every day.',
      body: 'They gather into a globe of your own. The longer you keep it, the more it holds.',
      orb: layered,
    },
  ];

  const screen = SCREENS[step];

  const begin = async () => {
    await updateSettings({ onboarded: true });
    router.replace({ pathname: '/compose-orb', params: { day: todayKey() } });
  };

  const skip = async () => {
    await updateSettings({ onboarded: true });
    router.replace('/');
  };

  return (
    <Paper edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Animated.View
          key={`${step}-${phase}`}
          entering={reduceMotion ? undefined : FadeIn.duration(520)}
          exiting={reduceMotion ? undefined : FadeOut.duration(280)}
          style={styles.stage}
        >
          <EmotionalOrb orb={screen.orb} size={size} />
        </Animated.View>

        <Animated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(400)}>
          <Text style={[t('title'), styles.title]} accessibilityRole="header">
            {screen.title}
          </Text>
          <Text style={[t('body', { color: c.inkSoft }), styles.blurb]}>{screen.body}</Text>
        </Animated.View>
      </View>

      <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of 3`}>
        {SCREENS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i === step ? c.ink : c.lineStrong }]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <QuietButton
          label={step === SCREENS.length - 1 ? 'Colour today' : 'Next'}
          tone="primary"
          onPress={() => (step === SCREENS.length - 1 ? begin() : setStep((s) => s + 1))}
        />
        <TextAction label="Skip for now" align="center" onPress={skip} />
      </View>
    </Paper>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.xxl },
  stage: { alignItems: 'center' },
  title: { textAlign: 'center' },
  blurb: { textAlign: 'center', marginTop: space.md, paddingHorizontal: space.md },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footer: { paddingBottom: space.md, gap: space.xs },
});
