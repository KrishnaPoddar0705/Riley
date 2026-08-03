import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AttachmentTray, captureFromCamera, pickMedia } from '@/components/Capture';
import {
  GlassButton,
  Pill,
  PressableCard,
  PrimaryButton,
  ScriptHeading,
  SegmentedPills,
} from '@/components/Clay';
import { EmotionDial } from '@/components/EmotionDial';
import { HeroOrb } from '@/components/Orb';
import { Screen } from '@/components/Screen';
import { byValence, EMOTIONS, type Valence } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import type { Attachment } from '@/store/types';
import type { SpectrumKey } from '@/theme';
import { clayTight, motion, palette, radius, space, type } from '@/theme';
import { formatLong, todayKey } from '@/utils/date';
import { makeId } from '@/utils/id';
import { VoiceRecorder } from '@/components/VoiceRecorder';

type Step = 'feel' | 'reflect';

export default function CheckInScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? todayKey();

  const { moods, saveMood, addEntry } = useDiary();
  const existing = moods[day];

  const [step, setStep] = useState<Step>('feel');
  const [valence, setValence] = useState<Valence>(existing?.valence ?? 'positive');
  const options = useMemo(() => byValence(valence), [valence]);

  const [index, setIndex] = useState(() => {
    if (!existing) return 0;
    const list = byValence(existing.valence);
    const i = list.findIndex((e) => e.key === existing.emotion);
    return i < 0 ? 0 : i;
  });

  const [note, setNote] = useState(existing?.note ?? '');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [also, setAlso] = useState<SpectrumKey[]>(existing?.also ?? []);

  // Intensity lives on the UI thread so dragging the orb never drops a frame.
  const intensity = useSharedValue(existing?.intensity ?? 0.72);
  const [committedIntensity, setCommittedIntensity] = useState(existing?.intensity ?? 0.72);
  const dragging = useSharedValue(0);
  const startedAt = useRef(intensity.value);

  const emotion = options[Math.min(index, options.length - 1)] ?? EMOTIONS[0];
  const orbSize = Math.min(width * 0.62, 250);

  useEffect(() => {
    // Swapping valence resets to the first emotion of the new family.
    setIndex(0);
  }, [valence]);

  const commitIntensity = useCallback((v: number) => setCommittedIntensity(v), []);

  const intensityPan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          dragging.value = withSpring(1, motion.springSoft);
        })
        .onChange((e) => {
          const next = intensity.value - e.changeY / 260;
          intensity.value = Math.max(0.12, Math.min(1, next));
        })
        .onFinalize(() => {
          dragging.value = withSpring(0, motion.springSoft);
          runOnJS(commitIntensity)(intensity.value);
        }),
    [intensity, dragging, commitIntensity]
  );

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.78 + intensity.value * 0.28 + dragging.value * 0.02 }],
  }));

  const hintStyle = useAnimatedStyle(() => ({ opacity: 0.35 + dragging.value * 0.6 }));

  const toggleAlso = (key: SpectrumKey) => {
    Haptics.selectionAsync().catch(() => {});
    setAlso((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(0, 3)
    );
  };

  const addAttachments = (next: Attachment[]) =>
    setAttachments((prev) => [...prev, ...next].slice(0, 8));

  const save = async () => {
    await saveMood({
      day,
      valence,
      emotion: emotion.key,
      intensity: committedIntensity,
      also: also.filter((k) => k !== emotion.key),
      note: note.trim() || undefined,
    });

    if (attachments.length) {
      const primary = attachments.find((a) => a.kind === 'voice') ?? attachments[0];
      await addEntry({
        day,
        kind: primary.kind,
        text: note.trim(),
        attachments,
        emotion: emotion.key,
        tags: ['check-in'],
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <Screen tint={emotion.color} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <GlassButton
            onPress={() => (step === 'reflect' ? setStep('feel') : router.back())}
            size={40}
          >
            <Ionicons
              name={step === 'reflect' ? 'chevron-back' : 'close'}
              size={18}
              color={palette.ink}
            />
          </GlassButton>
          <Text style={type.label}>{formatLong(day)}</Text>
          <GlassButton
            size={40}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              intensity.value = withSpring(startedAt.current, motion.springSoft);
              setCommittedIntensity(startedAt.current);
              setNote(existing?.note ?? '');
              setAttachments([]);
              setAlso(existing?.also ?? []);
            }}
          >
            <Ionicons name="arrow-undo-outline" size={17} color={palette.ink} />
          </GlassButton>
        </View>

        {step === 'feel' ? (
          <Animated.View
            key="feel"
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(140)}
            style={styles.flex}
          >
            <View style={styles.headBlock}>
              <ScriptHeading plain="What do you feel" script="today?" size={26} />
            </View>

            <View style={styles.valenceRow}>
              <SegmentedPills
                options={[
                  { value: 'positive' as Valence, label: 'Positive' },
                  { value: 'negative' as Valence, label: 'Negative' },
                ]}
                value={valence}
                onChange={setValence}
              />
            </View>

            <GestureDetector gesture={intensityPan}>
              <Animated.View style={[styles.orbStage, orbStyle]}>
                <HeroOrb size={orbSize} color={emotion.color} intensity={committedIntensity} />
              </Animated.View>
            </GestureDetector>

            <Animated.Text style={[type.caption, styles.dragHint, hintStyle]}>
              drag the orb up or down to set how strongly
            </Animated.Text>

            <EmotionDial
              emotions={options}
              index={Math.min(index, options.length - 1)}
              onIndexChange={setIndex}
              strength={intensity}
            />

            <Animated.Text
              key={emotion.key}
              entering={FadeIn.duration(300)}
              style={[type.body, styles.whisper]}
            >
              {emotion.whisper}
            </Animated.Text>

            <View style={styles.footer}>
              <PrimaryButton
                label="Next"
                tint={emotion.color}
                onPress={() => setStep('reflect')}
              />
            </View>
          </Animated.View>
        ) : (
          <Animated.View
            key="reflect"
            entering={SlideInRight.duration(280)}
            exiting={FadeOut.duration(140)}
            style={styles.flex}
          >
            <ScrollView
              contentContainerStyle={styles.reflectContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.reflectHead}>
                <HeroOrb
                  size={92}
                  color={emotion.color}
                  intensity={committedIntensity}
                  breathing={false}
                />
                <View style={{ flex: 1 }}>
                  <Text style={type.caption}>Today is</Text>
                  <Text style={[type.title, { fontSize: 24 }]}>{emotion.label}</Text>
                  <Text style={type.caption}>
                    {Math.round(committedIntensity * 100)}% · {valence}
                  </Text>
                </View>
              </View>

              <Text style={[type.overline, styles.blockLabel]}>Anything else in there?</Text>
              <View style={styles.alsoWrap}>
                {options
                  .filter((e) => e.key !== emotion.key)
                  .map((e) => (
                    <Pill
                      key={e.key}
                      label={e.label}
                      active={also.includes(e.key)}
                      tint={e.color}
                      onPress={() => toggleAlso(e.key)}
                    />
                  ))}
              </View>

              <Text style={[type.overline, styles.blockLabel]}>Why?</Text>
              <View style={styles.noteBox}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={emotion.whisper}
                  placeholderTextColor={palette.inkGhost}
                  multiline
                  style={styles.noteInput}
                  textAlignVertical="top"
                />
              </View>

              <Text style={[type.overline, styles.blockLabel]}>Keep something from today</Text>
              <View style={styles.mediaRow}>
                <MediaChip
                  icon="mic-outline"
                  label={showRecorder ? 'Close' : 'Voice'}
                  onPress={() => setShowRecorder((s) => !s)}
                  tint={emotion.color}
                />
                <MediaChip
                  icon="image-outline"
                  label="Photos"
                  onPress={async () => addAttachments(await pickMedia('photo'))}
                  tint={emotion.color}
                />
                <MediaChip
                  icon="videocam-outline"
                  label="Video"
                  onPress={async () => addAttachments(await pickMedia('video'))}
                  tint={emotion.color}
                />
                <MediaChip
                  icon="camera-outline"
                  label="Camera"
                  onPress={async () => addAttachments(await captureFromCamera('photo'))}
                  tint={emotion.color}
                />
              </View>

              {showRecorder ? (
                <Animated.View
                  entering={FadeInDown.duration(240)}
                  exiting={FadeOut.duration(140)}
                  style={styles.recorderBox}
                >
                  <VoiceRecorder
                    tint={emotion.color}
                    onCaptured={(uri, duration) => {
                      addAttachments([{ id: makeId('a'), kind: 'voice', uri, duration }]);
                      setShowRecorder(false);
                    }}
                  />
                </Animated.View>
              ) : null}

              <AttachmentTray
                attachments={attachments}
                tint={emotion.color}
                onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
              />
            </ScrollView>

            <View style={styles.footer}>
              <PrimaryButton label="Save today" tint={emotion.color} onPress={save} />
            </View>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const MediaChip = ({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint: string;
}) => (
  <PressableCard onPress={onPress} style={styles.mediaChip}>
    <Ionicons name={icon} size={15} color={tint} />
    <Text style={[type.label, { color: palette.ink }]}>{label}</Text>
  </PressableCard>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  headBlock: { alignItems: 'center', marginTop: space.lg },
  valenceRow: { marginTop: space.md },
  orbStage: { alignItems: 'center', justifyContent: 'center', marginTop: space.md, flexShrink: 1 },
  dragHint: { textAlign: 'center', marginTop: space.sm },
  whisper: {
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: space.xl,
    marginTop: space.xs,
  },
  footer: { marginTop: 'auto', paddingHorizontal: space.md, paddingBottom: space.md, paddingTop: space.md },
  reflectContent: { paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.sm },
  reflectHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  blockLabel: { marginTop: space.md },
  alsoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  noteBox: {
    minHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    padding: space.md,
  },
  noteInput: { ...type.body, color: palette.ink, fontSize: 15.5, minHeight: 96 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  mediaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clayTight,
  },
  recorderBox: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
});
