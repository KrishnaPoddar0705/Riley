import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { AttachmentTray, openLink } from '@/components/Capture';
import { EmotionalOrb } from '@/components/EmotionalOrb';
import { Paper } from '@/components/Paper';
import { IconButton, QuietButton, Rule, TextAction } from '@/components/Primitives';
import { VoiceNotePlayer } from '@/components/VoiceRecorder';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { composition, isBlank } from '@/store/orb';
import { formatLong, relativeDay, todayKey } from '@/utils/date';

/**
 * A day, opened. The orb first, then what was written, then whatever was kept.
 */
export default function DayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t } = useTheme();
  const { day: raw } = useLocalSearchParams<{ day: string }>();
  const day = raw ?? todayKey();

  const { orbFor, noteFor, entriesFor, nameOf, saveNote, deleteDay } = useDiary();

  const orb = orbFor(day);
  const blank = isBlank(orb);
  const entries = entriesFor(day).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const [note, setNote] = useState(() => noteFor(day));
  const [editing, setEditing] = useState(false);

  const parts = blank ? [] : composition(orb!);
  const orbSize = Math.min(width * 0.5, 200);
  const mediaWidth = width - space.lg * 2;

  const commitNote = async () => {
    await saveNote(day, note);
    setEditing(false);
    Haptics.selectionAsync().catch(() => {});
  };

  const confirmDelete = () =>
    Alert.alert('Remove this day?', 'The orb and anything written on it will be erased.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteDay(day);
          router.back();
        },
      },
    ]);

  return (
    <Paper edges={['top', 'bottom']} padded={false}>
      <View style={styles.bar}>
        <IconButton label="Close" onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={c.ink} />
        </IconButton>
        <Text style={t('label', { color: c.inkSoft })}>{relativeDay(day)}</Text>
        <IconButton label="Remove this day" onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={19} color={c.inkFaint} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <EmotionalOrb orb={orb} size={orbSize} placeholder={blank} />
          <Text style={[t('meta', { color: c.inkFaint }), styles.date]}>
            {formatLong(day).toUpperCase()}
          </Text>
          {parts.length ? (
            <Text style={[t('body', { color: c.inkSoft }), styles.mix]}>
              {parts
                .slice(0, 3)
                .map((p) => `${Math.round(p.share * 100)}% ${nameOf(p.emotion).toLowerCase()}`)
                .join(' · ')}
            </Text>
          ) : null}
        </View>

        <View style={styles.body}>
          {editing ? (
            <>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                autoFocus
                placeholder="What made it feel this way?"
                placeholderTextColor={c.inkFaint}
                style={[t('prose'), styles.input, { color: c.ink }]}
                textAlignVertical="top"
                accessibilityLabel="Reflection"
              />
              <View style={styles.editRow}>
                <TextAction
                  label="Cancel"
                  onPress={() => {
                    setNote(noteFor(day));
                    setEditing(false);
                  }}
                />
                <TextAction label="Save" onPress={commitNote} />
              </View>
            </>
          ) : (
            <TextAction
              label={note.trim() || 'Add a few words'}
              onPress={() => setEditing(true)}
              textStyle={
                note.trim()
                  ? { ...t('prose'), color: c.ink }
                  : { ...t('body'), color: c.inkFaint }
              }
              style={styles.noteTap}
            />
          )}

          {entries.length ? <Rule style={{ marginVertical: space.lg }} /> : null}

          {entries.map((e) => (
            <View key={e.id} style={styles.entry}>
              {e.text.trim() ? <Text style={t('body')}>{e.text}</Text> : null}
              {e.attachments
                .filter((a) => a.kind === 'voice')
                .map((a) => (
                  <VoiceNotePlayer key={a.id} uri={a.uri} duration={a.duration} />
                ))}
              {e.attachments
                .filter((a) => a.kind === 'photo')
                .map((a) => (
                  <Image
                    key={a.id}
                    source={{ uri: a.uri }}
                    style={[styles.photo, { width: mediaWidth, height: mediaWidth * 0.72 }]}
                    contentFit="cover"
                    transition={180}
                  />
                ))}
              {e.attachments
                .filter((a) => a.kind === 'link')
                .map((a) => (
                  <TextAction
                    key={a.id}
                    label={a.title || a.uri.replace(/^https?:\/\//, '')}
                    onPress={() => openLink(a.uri)}
                  />
                ))}
              {e.attachments.some((a) => a.kind === 'video') ? (
                <AttachmentTray attachments={e.attachments.filter((a) => a.kind === 'video')} />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <QuietButton
          label={blank ? 'Shape this day' : 'Reshape the orb'}
          tone="primary"
          onPress={() => router.push({ pathname: '/compose-orb', params: { day } })}
        />
      </View>
    </Paper>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  content: { paddingBottom: space.xl },
  hero: { alignItems: 'center', paddingTop: space.lg, gap: space.md },
  date: { marginTop: space.sm },
  mix: { textAlign: 'center', paddingHorizontal: space.lg },
  body: { paddingHorizontal: space.lg, marginTop: space.xl },
  noteTap: { minHeight: 60, alignItems: 'flex-start' },
  input: { minHeight: 120 },
  editRow: { flexDirection: 'row', gap: space.lg },
  entry: { gap: space.md, marginBottom: space.lg },
  photo: { borderRadius: radius.md },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.sm, paddingTop: space.md },
});
