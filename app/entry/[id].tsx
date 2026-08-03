import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { KIND_META, openLink } from '@/components/Capture';
import { ClayCard, GlassButton, PressableCard } from '@/components/Clay';
import { Screen } from '@/components/Screen';
import { VoiceNotePlayer } from '@/components/VoiceRecorder';
import { emotionColor, emotionLabel, EMOTIONS } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import type { Attachment } from '@/store/types';
import { clayTight, palette, radius, space, type } from '@/theme';
import { formatTime, relativeDay } from '@/utils/date';

export default function EntryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries, updateEntry, deleteEntry } = useDiary();

  const entry = useMemo(() => entries.find((e) => e.id === id), [entries, id]);
  const [draft, setDraft] = useState(entry?.text ?? '');
  const [editing, setEditing] = useState(false);

  if (!entry) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.missing}>
          <Text style={type.heading}>That entry is gone</Text>
          <PressableCard onPress={() => router.back()} style={styles.cta}>
            <Text style={[type.label, { color: palette.ink }]}>Back</Text>
          </PressableCard>
        </View>
      </Screen>
    );
  }

  const meta = KIND_META[entry.kind];
  const tint = entry.emotion ? emotionColor(entry.emotion) : meta.color;
  const photos = entry.attachments.filter((a) => a.kind === 'photo');
  const videos = entry.attachments.filter((a) => a.kind === 'video');
  const voices = entry.attachments.filter((a) => a.kind === 'voice');
  const links = entry.attachments.filter((a) => a.kind === 'link');
  const mediaWidth = width - space.md * 2;

  const confirmDelete = () =>
    Alert.alert('Delete this entry?', 'It will not be recoverable.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          await deleteEntry(entry.id);
          router.back();
        },
      },
    ]);

  const saveEdit = async () => {
    await updateEntry(entry.id, { text: draft.trim() });
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <Screen tint={tint} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <GlassButton size={40} onPress={() => router.back()}>
          <Ionicons name="close" size={18} color={palette.ink} />
        </GlassButton>
        <Text style={type.label}>{relativeDay(entry.day)}</Text>
        <GlassButton size={40} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={17} color={palette.ink} />
        </GlassButton>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(380)} style={styles.metaRow}>
          <View style={[styles.kindDot, { backgroundColor: `${meta.color}1F` }]}>
            <Ionicons name={meta.icon} size={15} color={meta.color} />
          </View>
          <Text style={type.caption}>{formatTime(entry.createdAt)}</Text>
          {entry.emotion ? (
            <>
              <View style={styles.sep} />
              <Text style={[type.caption, { color: tint, fontWeight: '700' }]}>
                {emotionLabel(entry.emotion)}
              </Text>
            </>
          ) : null}
          <PressableCard
            onPress={() => updateEntry(entry.id, { pinned: !entry.pinned })}
            style={styles.pin}
          >
            <Ionicons
              name={entry.pinned ? 'bookmark' : 'bookmark-outline'}
              size={15}
              color={entry.pinned ? tint : palette.inkFaint}
            />
          </PressableCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(380)}>
          <ClayCard style={styles.textCard}>
            {editing ? (
              <>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  autoFocus
                  style={styles.input}
                  textAlignVertical="top"
                  placeholder="Write something"
                  placeholderTextColor={palette.inkGhost}
                />
                <View style={styles.editRow}>
                  <PressableCard
                    onPress={() => {
                      setDraft(entry.text);
                      setEditing(false);
                    }}
                    style={styles.editChip}
                  >
                    <Text style={type.label}>Cancel</Text>
                  </PressableCard>
                  <PressableCard onPress={saveEdit} style={[styles.editChip, { backgroundColor: `${tint}22` }]}>
                    <Text style={[type.label, { color: palette.ink }]}>Save</Text>
                  </PressableCard>
                </View>
              </>
            ) : (
              <PressableCard onPress={() => setEditing(true)} haptic={false}>
                <Text style={[type.body, styles.bodyText]}>
                  {entry.text.trim() || 'Tap to write something about this.'}
                </Text>
              </PressableCard>
            )}
          </ClayCard>
        </Animated.View>

        {voices.map((a) => (
          <Animated.View key={a.id} entering={FadeIn.duration(320)}>
            <VoiceNotePlayer uri={a.uri} duration={a.duration} tint={tint} />
          </Animated.View>
        ))}

        {photos.map((a) => (
          <Animated.View key={a.id} entering={FadeIn.duration(320)}>
            <Image
              source={{ uri: a.uri }}
              style={[
                styles.photo,
                { width: mediaWidth, height: mediaWidth * ratioFor(a) },
              ]}
              contentFit="cover"
              transition={200}
            />
          </Animated.View>
        ))}

        {videos.map((a) => (
          <VideoAttachment key={a.id} uri={a.uri} width={mediaWidth} />
        ))}

        {links.map((a) => (
          <PressableCard key={a.id} onPress={() => openLink(a.uri)} style={styles.linkCard}>
            <View style={[styles.kindDot, { backgroundColor: `${KIND_META.link.color}1F` }]}>
              <Ionicons name="link-outline" size={15} color={KIND_META.link.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[type.label, { color: palette.ink }]}>
                {a.title || a.uri.replace(/^https?:\/\//, '')}
              </Text>
              <Text numberOfLines={1} style={type.caption}>
                {a.uri}
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={palette.inkFaint} />
          </PressableCard>
        ))}

        <Text style={[type.overline, { marginTop: space.md }]}>Colour</Text>
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.swatches}
        >
          <PressableCard
            onPress={() => updateEntry(entry.id, { emotion: null })}
            style={[styles.swatch, !entry.emotion && styles.swatchActive]}
          >
            <View style={styles.swatchNone} />
          </PressableCard>
          {EMOTIONS.map((e) => (
            <PressableCard
              key={e.key}
              onPress={() => updateEntry(entry.id, { emotion: e.key })}
              style={[styles.swatch, entry.emotion === e.key && styles.swatchActive]}
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

        {entry.tags.length ? (
          <View style={styles.tags}>
            {entry.tags.map((t) => (
              <View key={t} style={[clayTight, styles.tag]}>
                <Text style={type.caption}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const ratioFor = (a: Attachment) => {
  if (!a.width || !a.height) return 0.75;
  return Math.min(1.5, Math.max(0.5, a.height / a.width));
};

const VideoAttachment = ({ uri, width }: { uri: string; width: number }) => {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
  });
  return (
    <Animated.View entering={FadeIn.duration(320)}>
      <VideoView
        player={player}
        style={[styles.photo, { width, height: width * 0.62 }]}
        contentFit="cover"
        nativeControls
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  content: { paddingHorizontal: space.md, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  kindDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sep: { width: 3, height: 3, borderRadius: 2, backgroundColor: palette.inkGhost },
  pin: { marginLeft: 'auto', padding: 6 },
  textCard: { borderRadius: radius.lg },
  bodyText: { color: palette.ink, fontSize: 16, lineHeight: 24 },
  input: { ...type.body, color: palette.ink, fontSize: 16, minHeight: 120, lineHeight: 24 },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs, marginTop: space.sm },
  editChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  photo: {
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clayTight,
  },
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  cta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
});
