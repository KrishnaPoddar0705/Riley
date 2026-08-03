import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { AttachmentTray, captureFromCamera, pickMedia } from '@/components/Capture';
import { OrbPainter } from '@/components/OrbPainter';
import { Paper } from '@/components/Paper';
import { IconButton, QuietButton, Rule, TextAction } from '@/components/Primitives';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import type { EmotionKey } from '@/emotions/palette';
import { useDiary } from '@/store/DiaryProvider';
import { emptyOrb, isBlank, Orb } from '@/store/orb';
import type { Attachment } from '@/store/types';
import { formatLong, relativeDay, todayKey } from '@/utils/date';
import { makeId } from '@/utils/id';

/**
 * The daily ritual: shape the orb, say why if you want to, save.
 *
 * Colour first and always — the writing prompt does not appear until there is
 * something on the orb, so the flow never opens onto an empty form.
 */
export default function ComposeOrbScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t, reduceMotion } = useTheme();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? todayKey();

  const { orbFor, noteFor, nameOf, saveOrb, saveNote, addEntry } = useDiary();

  const existing = orbFor(day);
  const [orb, setOrb] = useState<Orb>(() => existing ?? emptyOrb(day));
  const [note, setNote] = useState(() => noteFor(day));
  const [active, setActive] = useState<EmotionKey>('calm');
  const [wantsMore, setWantsMore] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const saving = useRef(false);

  const painted = !isBlank(orb);
  const canvas = Math.min(width - space.lg * 2, 300);

  const save = useCallback(async () => {
    if (saving.current || !painted) return;
    saving.current = true;
    await saveOrb(orb);
    await saveNote(day, note);
    if (attachments.length) {
      const primary = attachments.find((a) => a.kind === 'voice') ?? attachments[0];
      await addEntry({ day, kind: primary.kind, text: '', attachments, tags: [] });
    }
    // One soft confirmation. No celebration, no score.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }, [painted, orb, note, day, attachments, saveOrb, saveNote, addEntry, router]);

  const addAttachments = (next: Attachment[]) =>
    setAttachments((prev) => [...prev, ...next].slice(0, 6));

  const activeName = useMemo(() => nameOf(active), [nameOf, active]);

  return (
    <Paper edges={['top', 'bottom']}>
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
          <Text style={[t('title'), styles.question]}>
            What did today <Text style={t('display', { fontSize: 26, lineHeight: 32 })}>feel</Text> like?
          </Text>
          <Text style={[t('caption', { color: c.inkFaint }), styles.pigment]}>{activeName}</Text>

          <OrbPainter
            orb={orb}
            onChange={setOrb}
            size={canvas}
            nameOf={nameOf}
            active={active}
            onActiveChange={setActive}
          />

          {/* The prompt only arrives once there is something to explain. */}
          {painted ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.duration(320)}
              style={styles.reflect}
            >
              <Rule style={{ marginBottom: space.lg }} />
              <Text style={t('heading')}>What made it feel this way?</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="A line is enough."
                placeholderTextColor={c.inkFaint}
                multiline
                style={[t('prose'), styles.input, { color: c.ink }]}
                textAlignVertical="top"
                accessibilityLabel="Today's reflection"
              />

              {!wantsMore ? (
                <TextAction label="Write more, or add a voice note or photo" onPress={() => setWantsMore(true)} />
              ) : (
                <Animated.View
                  entering={reduceMotion ? undefined : FadeIn.duration(240)}
                  style={styles.more}
                >
                  <View style={styles.moreRow}>
                    <TextAction
                      label={showRecorder ? 'Close recorder' : 'Voice note'}
                      onPress={() => setShowRecorder((v) => !v)}
                    />
                    <TextAction
                      label="Photo"
                      onPress={async () => addAttachments(await pickMedia('photo'))}
                    />
                    <TextAction
                      label="Camera"
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
              )}
            </Animated.View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <QuietButton
            label="Save today"
            tone="primary"
            disabled={!painted}
            onPress={save}
            accessibilityHint={
              painted ? 'Saves the orb into your globe' : 'Add a colour to the orb first'
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
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl },
  question: { textAlign: 'center' },
  pigment: { textAlign: 'center', marginTop: space.xs, marginBottom: space.lg },
  reflect: { marginTop: space.xl },
  input: { minHeight: 90, marginTop: space.md, marginBottom: space.sm },
  more: { gap: space.sm },
  moreRow: { flexDirection: 'row', gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
});
