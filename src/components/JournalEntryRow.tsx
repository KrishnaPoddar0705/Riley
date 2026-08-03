import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { EmotionKey } from '@/emotions/palette';
import type { Orb } from '@/store/orb';
import { composition, isBlank } from '@/store/orb';
import type { Entry } from '@/store/types';
import type { DayKey } from '@/utils/date';
import { fromDayKey, relativeDay } from '@/utils/date';
import { EmotionalOrb } from './EmotionalOrb';

type Props = {
  day: DayKey;
  orb: Orb | null;
  note: string;
  entries: Entry[];
  nameOf: (k: EmotionKey) => string;
  onPress: () => void;
};

/**
 * One day in the timeline: its orb, the date, and the first line of whatever
 * was written. Everything else waits until the day is opened.
 */
export const JournalEntryRow = ({ day, orb, note, entries, nameOf, onPress }: Props) => {
  const { c, t } = useTheme();

  const parts = orb && !isBlank(orb) ? composition(orb).slice(0, 2) : [];
  const photo = entries.flatMap((e) => e.attachments).find((a) => a.kind === 'photo');
  const hasVoice = entries.some((e) => e.attachments.some((a) => a.kind === 'voice'));
  const line = note.trim() || entries.find((e) => e.text.trim())?.text.trim() || '';
  const weekday = fromDayKey(day).toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        `${relativeDay(day)}. ` +
        (parts.length ? `${parts.map((p) => nameOf(p.emotion)).join(' and ')}. ` : 'No orb. ') +
        (line ? line : 'No words.')
      }
      style={styles.row}
    >
      <View style={styles.orbCol}>
        <EmotionalOrb orb={orb} size={40} glow={false} placeholder={isBlank(orb)} />
      </View>

      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={t('label', { color: c.ink })}>{relativeDay(day)}</Text>
          <Text style={t('caption', { color: c.inkFaint })}>{weekday}</Text>
        </View>

        {parts.length ? (
          <Text style={t('caption', { color: c.inkSoft })} numberOfLines={1}>
            {parts.map((p) => nameOf(p.emotion)).join(' · ')}
          </Text>
        ) : null}

        {line ? (
          <Text style={t('body', { color: c.inkSoft })} numberOfLines={2}>
            {line}
          </Text>
        ) : null}

        {hasVoice ? (
          <View style={styles.badge}>
            <Ionicons name="mic-outline" size={13} color={c.inkFaint} />
            <Text style={t('caption', { color: c.inkFaint })}>Voice note</Text>
          </View>
        ) : null}
      </View>

      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" transition={160} />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.lg,
  },
  orbCol: { width: 40, paddingTop: 2 },
  body: { flex: 1, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
});
