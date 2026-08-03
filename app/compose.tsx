import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import {
  AttachmentTray,
  captureFromCamera,
  KIND_META,
  pickMedia,
} from '@/components/Capture';
import { GlassButton, Pill, PressableCard, PrimaryButton, ScriptHeading } from '@/components/Clay';
import { Screen } from '@/components/Screen';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { EMOTIONS, emotionColor } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import type { Attachment, CaptureKind } from '@/store/types';
import type { SpectrumKey } from '@/theme';
import { clayTight, palette, radius, space, spectrum, type } from '@/theme';
import { relativeDay, todayKey } from '@/utils/date';
import { makeId } from '@/utils/id';

const TAG_SUGGESTIONS = ['idea', 'note to self', 'read later', 'people', 'work', 'health'];

export default function ComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: CaptureKind; day?: string }>();
  const day = params.day ?? todayKey();
  const { addEntry, moods } = useDiary();

  const [text, setText] = useState('');
  const [linkDraft, setLinkDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [emotion, setEmotion] = useState<SpectrumKey | null>(moods[day]?.emotion ?? null);
  const [showRecorder, setShowRecorder] = useState(params.kind === 'voice');
  const [showLink, setShowLink] = useState(params.kind === 'link');

  const tint = emotion ? emotionColor(emotion) : spectrum.confidence;

  // Deep-linked from a capture button: open the right picker straight away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (params.kind === 'photo' || params.kind === 'video') {
        const picked = await pickMedia(params.kind);
        if (!cancelled && picked.length) setAttachments((prev) => [...prev, ...picked]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.kind]);

  const kind: CaptureKind = useMemo(() => {
    if (attachments.some((a) => a.kind === 'voice')) return 'voice';
    if (attachments.some((a) => a.kind === 'video')) return 'video';
    if (attachments.some((a) => a.kind === 'photo')) return 'photo';
    if (attachments.some((a) => a.kind === 'link')) return 'link';
    return 'text';
  }, [attachments]);

  const canSave = text.trim().length > 0 || attachments.length > 0;

  const addAttachments = (next: Attachment[]) =>
    setAttachments((prev) => [...prev, ...next].slice(0, 10));

  const commitLink = () => {
    const raw = linkDraft.trim();
    if (!raw) return;
    addAttachments([
      {
        id: makeId('a'),
        kind: 'link',
        uri: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
        title: raw.replace(/^https?:\/\//, ''),
      },
    ]);
    setLinkDraft('');
    setShowLink(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const save = async () => {
    if (!canSave) return;
    await addEntry({ day, kind, text: text.trim(), attachments, emotion, tags });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const toggleTag = (t: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4)));
  };

  return (
    <Screen tint={tint} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.topBar}>
          <GlassButton size={40} onPress={() => router.back()}>
            <Ionicons name="close" size={18} color={palette.ink} />
          </GlassButton>
          <Text style={type.label}>{relativeDay(day)}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ScriptHeading plain="Save it before" script="you lose it" align="left" size={24} />

          <View style={styles.editor}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="What happened, what you thought, what you want to remember…"
              placeholderTextColor={palette.inkGhost}
              multiline
              autoFocus={!params.kind || params.kind === 'text'}
              style={styles.input}
              textAlignVertical="top"
            />
          </View>

          <Animated.View layout={LinearTransition.springify()} style={styles.actionRow}>
            <Action
              icon="mic-outline"
              label="Voice"
              tint={KIND_META.voice.color}
              active={showRecorder}
              onPress={() => setShowRecorder((s) => !s)}
            />
            <Action
              icon="image-outline"
              label="Photo"
              tint={KIND_META.photo.color}
              onPress={async () => addAttachments(await pickMedia('photo'))}
            />
            <Action
              icon="videocam-outline"
              label="Video"
              tint={KIND_META.video.color}
              onPress={async () => addAttachments(await pickMedia('video'))}
            />
            <Action
              icon="camera-outline"
              label="Camera"
              tint={spectrum.excitement}
              onPress={async () => addAttachments(await captureFromCamera('photo'))}
            />
            <Action
              icon="link-outline"
              label="Link"
              tint={KIND_META.link.color}
              active={showLink}
              onPress={() => setShowLink((s) => !s)}
            />
          </Animated.View>

          {showLink ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              exiting={FadeOut.duration(140)}
              style={[clayTight, styles.linkBar]}
            >
              <Ionicons name="link-outline" size={16} color={KIND_META.link.color} />
              <TextInput
                value={linkDraft}
                onChangeText={setLinkDraft}
                placeholder="paste a url"
                placeholderTextColor={palette.inkGhost}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={commitLink}
                style={styles.linkInput}
              />
              <PressableCard onPress={commitLink} style={styles.linkAdd}>
                <Ionicons name="arrow-up" size={15} color={palette.ink} />
              </PressableCard>
            </Animated.View>
          ) : null}

          {showRecorder ? (
            <Animated.View
              entering={FadeInDown.duration(240)}
              exiting={FadeOut.duration(140)}
              style={styles.recorderBox}
            >
              <VoiceRecorder
                tint={tint}
                onCaptured={(uri, duration) => {
                  addAttachments([{ id: makeId('a'), kind: 'voice', uri, duration }]);
                  setShowRecorder(false);
                }}
              />
            </Animated.View>
          ) : null}

          <AttachmentTray
            attachments={attachments}
            tint={tint}
            onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          />

          <Text style={[type.overline, styles.blockLabel]}>Colour it</Text>
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatches}
          >
            <PressableCard
              onPress={() => setEmotion(null)}
              style={[styles.swatch, !emotion && styles.swatchActive]}
            >
              <View style={styles.swatchNone} />
            </PressableCard>
            {EMOTIONS.map((e) => (
              <PressableCard
                key={e.key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setEmotion(e.key);
                }}
                style={[
                  styles.swatch,
                  emotion === e.key && styles.swatchActive,
                  emotion === e.key && { borderColor: `${e.color}88` },
                ]}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: e.color,
                    shadowColor: e.color,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.6,
                    shadowRadius: 8,
                  }}
                />
              </PressableCard>
            ))}
          </Animated.ScrollView>

          <Text style={[type.overline, styles.blockLabel]}>Tag it</Text>
          <View style={styles.tagRow}>
            {TAG_SUGGESTIONS.map((t) => (
              <Pill key={t} label={`#${t}`} active={tags.includes(t)} onPress={() => toggleTag(t)} />
            ))}
          </View>
        </ScrollView>

        <Animated.View entering={FadeIn.duration(200)} style={styles.footer}>
          <PrimaryButton label="Save to Riley" tint={tint} disabled={!canSave} onPress={save} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const Action = ({
  icon,
  label,
  tint,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
  active?: boolean;
}) => (
  <PressableCard onPress={onPress} style={styles.actionItem}>
    <View
      style={[
        styles.actionButton,
        { shadowColor: tint },
        active && { backgroundColor: `${tint}22`, borderColor: `${tint}66` },
      ]}
    >
      <Ionicons name={icon} size={20} color={tint} />
    </View>
    <Text style={[type.caption, { marginTop: 5 }]}>{label}</Text>
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
  content: { paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.lg },
  editor: {
    minHeight: 150,
    marginTop: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    padding: space.md,
    ...clayTight,
  },
  input: { ...type.body, color: palette.ink, fontSize: 16, minHeight: 124, lineHeight: 24 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  actionItem: { alignItems: 'center', flex: 1 },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  linkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.md,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  linkInput: { flex: 1, ...type.body, fontSize: 15, color: palette.ink, paddingVertical: 0 },
  linkAdd: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  recorderBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  blockLabel: { marginTop: space.lg, marginBottom: space.sm },
  swatches: { gap: space.xs, paddingRight: space.md },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  swatchActive: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: palette.edge,
    ...clayTight,
  },
  swatchNone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.inkGhost,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  footer: { paddingHorizontal: space.md, paddingBottom: space.md, paddingTop: space.sm },
});
