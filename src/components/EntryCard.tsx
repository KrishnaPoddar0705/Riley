import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { emotionColor, emotionLabel } from '@/emotions/catalog';
import type { Entry } from '@/store/types';
import { clayTight, palette, radius, space, type } from '@/theme';
import { formatTime } from '@/utils/date';
import { KIND_META } from './Capture';
import { PressableCard } from './Clay';

const previewFor = (entry: Entry) => {
  if (entry.text.trim()) return entry.text.trim();
  const link = entry.attachments.find((a) => a.kind === 'link');
  if (link) return link.title || link.uri.replace(/^https?:\/\//, '');
  const voice = entry.attachments.find((a) => a.kind === 'voice');
  if (voice) return `Voice note · ${voice.duration ?? 0}s`;
  const media = entry.attachments.length;
  if (media) return `${media} ${media === 1 ? 'attachment' : 'attachments'}`;
  return 'Empty note';
};

export const EntryCard = ({ entry, onPress }: { entry: Entry; onPress?: () => void }) => {
  const meta = KIND_META[entry.kind];
  const tint = entry.emotion ? emotionColor(entry.emotion) : meta.color;
  const thumbs = entry.attachments.filter((a) => a.kind === 'photo' || a.kind === 'video').slice(0, 3);

  return (
    <PressableCard onPress={onPress} style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: tint }]} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={[styles.kindDot, { backgroundColor: `${meta.color}1F` }]}>
            <Ionicons name={meta.icon} size={13} color={meta.color} />
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
          {entry.pinned ? (
            <Ionicons
              name="bookmark"
              size={12}
              color={palette.inkFaint}
              style={{ marginLeft: 'auto' }}
            />
          ) : null}
        </View>

        <Text numberOfLines={3} style={[type.body, styles.preview]}>
          {previewFor(entry)}
        </Text>

        {thumbs.length ? (
          <View style={styles.thumbs}>
            {thumbs.map((a) => (
              <Image
                key={a.id}
                source={{ uri: a.uri }}
                style={styles.thumb}
                contentFit="cover"
                transition={150}
              />
            ))}
            {entry.attachments.length > thumbs.length ? (
              <View style={[styles.thumb, styles.thumbMore]}>
                <Text style={[type.caption, { color: palette.inkSoft }]}>
                  +{entry.attachments.length - thumbs.length}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {entry.tags.length ? (
          <View style={styles.tags}>
            {entry.tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={type.caption}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </PressableCard>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    overflow: 'hidden',
    ...clayTight,
  },
  stripe: { width: 4 },
  body: { flex: 1, padding: space.md, gap: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  kindDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  sep: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.inkGhost,
    marginHorizontal: 2,
  },
  preview: { fontSize: 14.5, lineHeight: 21, color: palette.ink },
  thumbs: { flexDirection: 'row', gap: 6, marginTop: 4 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  thumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.edge,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.edge,
  },
});
