import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AttachmentTray, captureFromCamera, pickMedia } from '@/components/Capture';
import { EmotionalOrb } from '@/components/EmotionalOrb';
import { FeelingComposer } from '@/components/FeelingComposer';
import { Paper } from '@/components/Paper';
import { IconButton, QuietButton, Rule, TextAction } from '@/components/Primitives';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useTheme } from '@/design/theme';
import { motion, space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { describeOrb, emptyOrb, isBlank, Orb } from '@/store/orb';
import type { Attachment } from '@/store/types';
import { formatLong, relativeDay, todayKey } from '@/utils/date';
import { makeId } from '@/utils/id';

/**
 * The daily ritual.
 *
 * Name what was most present, say what was underneath it, write a line if you
 * want to, keep the day. Nothing on this screen is a tool.
 */
export default function ComposeOrbScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t, reduceMotion } = useTheme();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? todayKey();

  const { orbFor, noteFor, nameOf, saveOrb, saveNote, addEntry } = useDiary();

  const existing = orbFor(day);
  const saved = noteFor(day);

  const [orb, setOrb] = useState<Orb>(() => existing ?? emptyOrb(day));
  const [text, setText] = useState(saved.text ?? '');
  const [bright, setBright] = useState(saved.bright ?? '');
  const [difficult, setDifficult] = useState(saved.difficult ?? '');
  const [showBright, setShowBright] = useState(!!saved.bright);
  const [showDifficult, setShowDifficult] = useState(!!saved.difficult);
  const [showRecorder, setShowRecorder] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const busy = useRef(false);

  const described = !isBlank(orb);
  const orbSize = Math.min(width * 0.52, 210);

  /* The signature moment: the orb contracts and leaves for the globe. */
  const leaving = useSharedValue(0);
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - leaving.value * 0.72 }, { translateY: -leaving.value * 120 }],
    opacity: 1 - leaving.value * 0.85,
  }));

  const finish = useCallback(() => {
    router.back();
  }, [router]);

  const save = useCallback(async () => {
    if (busy.current || !described) return;
    busy.current = true;

    await saveOrb(orb);
    await saveNote(day, { text, bright, difficult });
    if (attachments.length) {
      const primary = attachments.find((a) => a.kind === 'voice') ?? attachments[0];
      await addEntry({ day, kind: primary.kind, text: '', attachments, tags: [] });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (reduceMotion) {
      finish();
      return;
    }
    // Contract, lift, and hand the day over to the globe behind.
    leaving.value = withSequence(
      withTiming(0.12, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: motion.morph, easing: Easing.in(Easing.cubic) }, (done) => {
        'worklet';
        if (done) runOnJS(finish)();
      })
    );
  }, [
    described,
    orb,
    day,
    text,
    bright,
    difficult,
    attachments,
    saveOrb,
    saveNote,
    addEntry,
    reduceMotion,
    leaving,
    finish,
  ]);

  const addAttachments = (next: Attachment[]) =>
    setAttachments((prev) => [...prev, ...next].slice(0, 6));

  return (
    <Paper edges={['top', 'bottom']} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.bar}>
          <IconButton label="Close" onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={c.ink} />
          </IconButton>
          <Text style={t('label', { color: c.inkSoft })}>
            {day === todayKey() ? formatLong(day) : relativeDay(day)}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.stage, orbStyle]}>
            <EmotionalOrb orb={orb} size={orbSize} placeholder={!described} breathing={!described} />
          </Animated.View>

          {described ? (
            <Animated.Text
              key={describeOrb(orb, nameOf)}
              entering={reduceMotion ? undefined : FadeIn.duration(260)}
              style={[t('quote', { color: c.inkSoft }), styles.summary]}
            >
              {describeOrb(orb, nameOf)}
            </Animated.Text>
          ) : null}

          <View style={styles.composer}>
            <FeelingComposer orb={orb} onChange={setOrb} nameOf={nameOf} />
          </View>

          {described ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.duration(300)}
              style={styles.write}
            >
              <Rule style={{ marginBottom: space.lg }} />
              <Text style={t('heading')}>What made today feel this way?</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="A line is enough."
                placeholderTextColor={c.inkFaint}
                multiline
                style={[t('prose'), styles.input, { color: c.ink }]}
                textAlignVertical="top"
                accessibilityLabel="What made today feel this way"
              />

              {showBright ? (
                <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)}>
                  <Text style={[t('meta', { color: c.inkFaint }), styles.small]}>A QUIET LIGHT</Text>
                  <TextInput
                    value={bright}
                    onChangeText={setBright}
                    placeholder="Something good, however small."
                    placeholderTextColor={c.inkFaint}
                    multiline
                    style={[t('body'), styles.smallInput, { color: c.ink }]}
                    textAlignVertical="top"
                    accessibilityLabel="A quiet light"
                  />
                </Animated.View>
              ) : null}

              {showDifficult ? (
                <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)}>
                  <Text style={[t('meta', { color: c.inkFaint }), styles.small]}>
                    WHAT WEIGHED ON ME
                  </Text>
                  <TextInput
                    value={difficult}
                    onChangeText={setDifficult}
                    placeholder="Only if you want to."
                    placeholderTextColor={c.inkFaint}
                    multiline
                    style={[t('body'), styles.smallInput, { color: c.ink }]}
                    textAlignVertical="top"
                    accessibilityLabel="What weighed on me"
                  />
                </Animated.View>
              ) : null}

              {/* Offered quietly, one at a time — never all at once. */}
              <View style={styles.extras}>
                {!showBright ? (
                  <TextAction label="Add a bright moment" onPress={() => setShowBright(true)} />
                ) : null}
                {!showDifficult ? (
                  <TextAction
                    label="Add something difficult"
                    onPress={() => setShowDifficult(true)}
                  />
                ) : null}
                <TextAction
                  label={showRecorder ? 'Close recorder' : 'Add a voice note'}
                  onPress={() => setShowRecorder((v) => !v)}
                />
                <TextAction label="Add a photo" onPress={async () => addAttachments(await pickMedia('photo'))} />
                <TextAction
                  label="Take a photo"
                  onPress={async () => addAttachments(await captureFromCamera('photo'))}
                />
              </View>

              {showRecorder ? (
                <Animated.View
                  entering={reduceMotion ? undefined : FadeIn.duration(220)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(160)}
                >
                  <VoiceRecorder
                    onCaptured={(uri, duration) => {
                      addAttachments([{ id: makeId('a'), kind: 'voice', uri, duration }]);
                      setShowRecorder(false);
                    }}
                  />
                </Animated.View>
              ) : null}

              <AttachmentTray
                attachments={attachments}
                onRemove={(id) => setAttachments((p) => p.filter((a) => a.id !== id))}
              />
            </Animated.View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <QuietButton
            label="Keep this day"
            tone="primary"
            disabled={!described}
            onPress={save}
            accessibilityHint={
              described ? 'Saves this day into your globe' : 'Choose a feeling first'
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Paper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl },
  stage: { alignItems: 'center' },
  summary: { textAlign: 'center', marginTop: space.lg, paddingHorizontal: space.md },
  composer: { marginTop: space.xl },
  write: { marginTop: space.xl },
  input: { minHeight: 88, marginTop: space.md },
  small: { marginTop: space.lg, marginBottom: space.xs },
  smallInput: { minHeight: 56 },
  extras: { marginTop: space.sm },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
});
