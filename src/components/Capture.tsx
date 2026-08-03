import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { clayTight, fill, palette, radius, space, type } from '@/theme';
import type { Attachment, CaptureKind } from '@/store/types';
import { makeId } from '@/utils/id';
import { PressableCard } from './Clay';
import { VoiceNotePlayer } from './VoiceRecorder';

export const KIND_META: Record<
  CaptureKind,
  { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }
> = {
  text: { icon: 'create-outline', label: 'Write', color: '#7B5BFF' },
  voice: { icon: 'mic-outline', label: 'Voice', color: '#FF7FA8' },
  photo: { icon: 'image-outline', label: 'Photo', color: '#63D8C6' },
  video: { icon: 'videocam-outline', label: 'Video', color: '#FF9A5B' },
  link: { icon: 'link-outline', label: 'Link', color: '#5B8DEF' },
};

/** The row of round capture buttons — the front door to the second brain. */
export const CaptureRail = ({
  onPick,
  style,
  kinds = ['text', 'voice', 'photo', 'video', 'link'],
}: {
  onPick: (kind: CaptureKind) => void;
  style?: ViewStyle;
  kinds?: CaptureKind[];
}) => (
  <View style={[styles.rail, style]}>
    {kinds.map((k) => {
      const meta = KIND_META[k];
      return (
        <PressableCard key={k} onPress={() => onPick(k)} style={styles.railItem}>
          <View style={[styles.railButton, { shadowColor: meta.color }]}>
            <View style={[styles.railTintWash, { backgroundColor: meta.color }]} />
            <Ionicons name={meta.icon} size={21} color={meta.color} />
          </View>
          <Text style={[type.caption, styles.railLabel]}>{meta.label}</Text>
        </PressableCard>
      );
    })}
  </View>
);

const normalizeUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const openLink = async (raw: string) => {
  const url = normalizeUrl(raw);
  if (!url) return;
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: palette.ink,
    });
  } catch {
    Linking.openURL(url).catch(() => {});
  }
};

/** Ask the OS for photos/videos and turn the result into attachments. */
export const pickMedia = async (
  kind: 'photo' | 'video'
): Promise<Attachment[]> => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      'Photos are off',
      'Riley needs photo access to attach a memory. You can turn it on in Settings.'
    );
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
    allowsMultipleSelection: kind === 'photo',
    selectionLimit: kind === 'photo' ? 6 : 1,
    quality: 0.85,
    videoMaxDuration: 120,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    id: makeId('a'),
    kind,
    uri: a.uri,
    width: a.width,
    height: a.height,
    duration: a.duration ? Math.round(a.duration / 1000) : undefined,
  }));
};

export const captureFromCamera = async (kind: 'photo' | 'video'): Promise<Attachment[]> => {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera is off', 'Riley needs camera access to capture a moment.');
    return [];
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
    quality: 0.85,
    videoMaxDuration: 120,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    id: makeId('a'),
    kind,
    uri: a.uri,
    width: a.width,
    height: a.height,
    duration: a.duration ? Math.round(a.duration / 1000) : undefined,
  }));
};

/** Grid of everything attached to an entry, with a remove affordance. */
export const AttachmentTray = ({
  attachments,
  onRemove,
  tint,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  tint?: string;
}) => {
  if (!attachments.length) return null;

  const media = attachments.filter((a) => a.kind === 'photo' || a.kind === 'video');
  const voices = attachments.filter((a) => a.kind === 'voice');
  const links = attachments.filter((a) => a.kind === 'link');

  return (
    <Animated.View layout={LinearTransition.springify()} style={styles.tray}>
      {media.length ? (
        <View style={styles.mediaGrid}>
          {media.map((a) => (
            <Animated.View
              key={a.id}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
              style={styles.thumbWrap}
            >
              <Image source={{ uri: a.uri }} style={styles.thumb} contentFit="cover" transition={180} />
              {a.kind === 'video' ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="play" size={11} color="#FFFFFF" />
                </View>
              ) : null}
              {onRemove ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onRemove(a.id);
                  }}
                  style={styles.removeDot}
                >
                  <Ionicons name="close" size={12} color={palette.ink} />
                </Pressable>
              ) : null}
            </Animated.View>
          ))}
        </View>
      ) : null}

      {voices.map((a) => (
        <Animated.View key={a.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
          <View style={styles.voiceRow}>
            <View style={{ flex: 1 }}>
              <VoiceNotePlayer uri={a.uri} duration={a.duration} tint={tint} />
            </View>
            {onRemove ? (
              <Pressable hitSlop={8} onPress={() => onRemove(a.id)} style={styles.removeInline}>
                <Ionicons name="close" size={14} color={palette.inkFaint} />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ))}

      {links.map((a) => (
        <Animated.View key={a.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
          <View style={styles.voiceRow}>
            <PressableCard onPress={() => openLink(a.uri)} style={styles.linkChip}>
              <Ionicons name="link-outline" size={15} color={KIND_META.link.color} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[type.label, { color: palette.ink }]}>
                  {a.title || a.uri.replace(/^https?:\/\//, '')}
                </Text>
                <Text numberOfLines={1} style={type.caption}>
                  {a.uri.replace(/^https?:\/\//, '').split('/')[0]}
                </Text>
              </View>
            </PressableCard>
            {onRemove ? (
              <Pressable hitSlop={8} onPress={() => onRemove(a.id)} style={styles.removeInline}>
                <Ionicons name="close" size={14} color={palette.inkFaint} />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', justifyContent: 'space-between' },
  railItem: { alignItems: 'center', flex: 1 },
  railButton: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 13,
  },
  railTintWash: { ...fill, opacity: 0.08 },
  railLabel: { marginTop: space.xs },
  tray: { gap: space.sm, marginTop: space.md },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumbWrap: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    overflow: 'visible',
  },
  thumb: {
    width: 82,
    height: 82,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  videoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,16,32,0.6)',
  },
  removeDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...clayTight,
  },
  removeInline: { padding: space.xs },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  linkChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clayTight,
  },
});
