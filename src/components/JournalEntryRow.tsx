import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { EmotionKey } from '@/emotions/palette';
import type { Orb } from '@/store/orb';
import { composition, describeOrb, isBlank } from '@/store/orb';
import type { DayNote, Entry } from '@/store/types';
import type { DayKey } from '@/utils/date';
import { formatTime, fromDayKey, relativeDay } from '@/utils/date';
import { EmotionalOrb } from './EmotionalOrb';

type Props = {
  day: DayKey;
  orb: Orb | null;
  note: DayNote;
  entries: Entry[];
  nameOf: (k: EmotionKey) => string;
  onPress: () => void;
};

/**
 * One day in the timeline. Orb, date, and the first line of whatever was
 * written — plus exactly one contextual detail, never a row of badges.
 */
export const JournalEntryRow = ({ day, orb, note, entries, nameOf, onPress }: Props) => {
  const { c, t } = useTheme();

  const blank = isBlank(orb);
  // Only named feelings appear. "Unnamed" would read as missing data.
  const feelings = blank ? [] : composition(orb!).slice(0, 2).map((p) => nameOf(p.emotion));
  const photo = entries.flatMap((e) => e.attachments).find((a) => a.kind === 'photo');
  const voice = entries.find((e) => e.attachments.some((a) => a.kind === 'voice'));
  const line = note.text || note.bright || entries.find((e) => e.text.trim())?.text || '';
  const weekday = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${relativeDay(day)}. ` +
        (blank ? 'Not coloured. ' : `${describeOrb(orb!, nameOf)} `) +
        (line || 'No words.')
      }
      style={styles.row}
    >
      <View style={styles.orbCol}>
        <EmotionalOrb orb={orb} size={42} glow={false} placeholder={blank} />
      </View>

      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={t('label', { color: c.ink })}>{relativeDay(day)}</Text>
          <Text style={t('caption', { color: c.inkFaint })}>{weekday}</Text>
        </View>

        {note.title ? <Text style={t('body', { color: c.ink })}>{note.title}</Text> : null}

        {feelings.length ? (
          <Text style={t('caption', { color: c.inkSoft })} numberOfLines={1}>
            {feelings.join(' · ')}
          </Text>
        ) : null}

        {line ? (
          <Text style={t('body', { color: c.inkSoft })} numberOfLines={2}>
            {line}
          </Text>
        ) : null}

        {/* One detail only: a voice note, or the time it was kept. */}
        {voice ? (
          <View style={styles.detail}>
            <Ionicons name="mic-outline" size={13} color={c.inkFaint} />
            <Text style={t('caption', { color: c.inkFaint })}>Voice note</Text>
          </View>
        ) : entries.length ? (
          <Text style={t('caption', { color: c.inkFaint })}>
            Kept at {formatTime(entries[0].createdAt)}
          </Text>
        ) : null}
      </View>

      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" transition={160} />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
  orbCol: { width: 42, paddingTop: 2 },
  body: { flex: 1, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
});
