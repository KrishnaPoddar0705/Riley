import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { openLink } from '@/components/Capture';
import { EmotionalOrb } from '@/components/EmotionalOrb';
import { Paper } from '@/components/Paper';
import { IconButton, Rule, TextAction } from '@/components/Primitives';
import { VoiceNotePlayer } from '@/components/VoiceRecorder';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { describeOrb, isBlank } from '@/store/orb';
import { formatLong, fromDayKey, relativeDay, todayKey } from '@/utils/date';

/**
 * A day, opened — a finished page rather than an editor.
 *
 * The date appears once. Editing is quiet. Deleting lives in the overflow,
 * because this is a memory, not a record to be managed.
 */
export default function DayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t } = useTheme();
  const { day: raw } = useLocalSearchParams<{ day: string }>();
  const day = raw ?? todayKey();

  const { orbFor, noteFor, entriesFor, nameOf, deleteDay } = useDiary();

  const orb = orbFor(day);
  const blank = isBlank(orb);
  const note = noteFor(day);
  const entries = entriesFor(day).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const orbSize = Math.min(width * 0.46, 190);
  const mediaWidth = width - space.lg * 2;
  const weekday = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long' });

  const confirmDelete = () =>
    Alert.alert('Remove this day?', 'The orb and everything written on it will be erased.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          await deleteDay(day);
          router.back();
        },
      },
    ]);

  const overflow = () => {
    const options = ['Make a keepsake', 'Remove this day', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) router.push({ pathname: '/keepsake', params: { day } });
          if (i === 1) confirmDelete();
        }
      );
    } else {
      Alert.alert('This day', undefined, [
        { text: 'Make a keepsake', onPress: () => router.push({ pathname: '/keepsake', params: { day } }) },
        { text: 'Remove this day', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <Paper edges={['top', 'bottom']} padded={false}>
      <View style={styles.bar}>
        <IconButton label="Close" onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={c.ink} />
        </IconButton>
        <IconButton label="More" onPress={overflow}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.inkSoft} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The date, once. */}
        <Text style={t('meta', { color: c.inkFaint })} accessibilityRole="header">
          {formatLong(day).toUpperCase()} · {weekday.toUpperCase()}
        </Text>
        {note.title ? <Text style={[t('title'), styles.title]}>{note.title}</Text> : null}

        <View style={styles.hero}>
          <EmotionalOrb orb={orb} size={orbSize} placeholder={blank} />
        </View>

        {!blank ? (
          <Text style={[t('quote', { color: c.inkSoft }), styles.summary]}>
            {describeOrb(orb!, nameOf)}
          </Text>
        ) : (
          <Text style={[t('body', { color: c.inkFaint }), styles.summary]}>
            This day was never coloured.
          </Text>
        )}

        {note.text ? (
          <Text style={[t('prose'), styles.body]}>{note.text}</Text>
        ) : (
          <TextAction
            label="Add a few words"
            onPress={() => router.push({ pathname: '/compose-orb', params: { day } })}
            style={styles.body}
          />
        )}

        {note.bright ? (
          <View style={styles.aside}>
            <Text style={t('meta', { color: c.inkFaint })}>A QUIET LIGHT</Text>
            <Text style={[t('body'), { marginTop: space.xs }]}>{note.bright}</Text>
          </View>
        ) : null}

        {note.difficult ? (
          <View style={styles.aside}>
            <Text style={t('meta', { color: c.inkFaint })}>WHAT WEIGHED ON ME</Text>
            <Text style={[t('body'), { marginTop: space.xs }]}>{note.difficult}</Text>
          </View>
        ) : null}

        {entries.length ? <Rule style={{ marginVertical: space.xl }} /> : null}

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
          </View>
        ))}

        <Rule style={{ marginTop: space.xl }} />
        <TextAction
          label={blank ? 'Colour this day' : 'Edit this day'}
          onPress={() => router.push({ pathname: '/compose-orb', params: { day } })}
          style={styles.edit}
        />
      </ScrollView>
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
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  title: { marginTop: space.xs },
  hero: { alignItems: 'center', marginTop: space.xl },
  summary: { marginTop: space.xl, textAlign: 'center' },
  body: { marginTop: space.xl },
  aside: { marginTop: space.xl },
  entry: { gap: space.md, marginBottom: space.lg },
  photo: { borderRadius: radius.md },
  edit: { marginTop: space.sm },
});
