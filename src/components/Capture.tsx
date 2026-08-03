import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { Attachment } from '@/store/types';
import { makeId } from '@/utils/id';
import { VoiceNotePlayer } from './VoiceRecorder';

const normalize = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const openLink = async (raw: string) => {
  const url = normalize(raw);
  if (!url) return;
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch {
    Linking.openURL(url).catch(() => {});
  }
};

const toAttachments = (
  assets: ImagePicker.ImagePickerAsset[],
  kind: 'photo' | 'video'
): Attachment[] =>
  assets.map((a) => ({
    id: makeId('a'),
    kind,
    uri: a.uri,
    width: a.width,
    height: a.height,
    duration: a.duration ? Math.round(a.duration / 1000) : undefined,
  }));

export const pickMedia = async (kind: 'photo' | 'video'): Promise<Attachment[]> => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos are off', 'Riley needs photo access to keep an image with a day.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
    allowsMultipleSelection: kind === 'photo',
    selectionLimit: kind === 'photo' ? 4 : 1,
    quality: 0.85,
    videoMaxDuration: 120,
  });
  if (result.canceled) return [];
  return toAttachments(result.assets, kind);
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
  return toAttachments(result.assets, kind);
};

/** Whatever was kept alongside a day, laid out plainly. */
export const AttachmentTray = ({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}) => {
  const { c, reduceMotion } = useTheme();
  if (!attachments.length) return null;

  const media = attachments.filter((a) => a.kind === 'photo' || a.kind === 'video');
  const voices = attachments.filter((a) => a.kind === 'voice');

  return (
    <View style={styles.tray}>
      {media.length ? (
        <View style={styles.grid}>
          {media.map((a) => (
            <Animated.View
              key={a.id}
              entering={reduceMotion ? undefined : FadeIn.duration(200)}
              exiting={reduceMotion ? undefined : FadeOut.duration(150)}
            >
              <Image source={{ uri: a.uri }} style={styles.thumb} contentFit="cover" transition={160} />
              {a.kind === 'video' ? (
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={10} color="#FFFFFF" />
                </View>
              ) : null}
              {onRemove ? (
                <Pressable
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onRemove(a.id);
                  }}
                  style={[styles.remove, { backgroundColor: c.surface, borderColor: c.line }]}
                >
                  <Ionicons name="close" size={12} color={c.ink} />
                </Pressable>
              ) : null}
            </Animated.View>
          ))}
        </View>
      ) : null}

      {voices.map((a) => (
        <Animated.View
          key={a.id}
          entering={reduceMotion ? undefined : FadeIn.duration(200)}
          exiting={reduceMotion ? undefined : FadeOut.duration(150)}
          style={styles.voiceRow}
        >
          <View style={{ flex: 1 }}>
            <VoiceNotePlayer uri={a.uri} duration={a.duration} />
          </View>
          {onRemove ? (
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Remove voice note"
              onPress={() => onRemove(a.id)}
              style={styles.removeInline}
            >
              <Ionicons name="close" size={15} color={c.inkFaint} />
            </Pressable>
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tray: { gap: space.md, marginTop: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.sm },
  playBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,18,14,0.55)',
  },
  remove: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeInline: { padding: space.sm },
  voiceRow: { flexDirection: 'row', alignItems: 'center' },
});
