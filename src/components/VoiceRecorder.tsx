import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  SharedValue,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { clayTight, motion, palette, radius, space, spectrum, type } from '@/theme';
import { hashUnit } from '@/utils/id';

const BARS = 34;

const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

/** Live level meter — a row of bars that breathe while you talk. */
const Waveform = ({ active, seed = 'w' }: { active: boolean; seed?: string }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(0, { duration: motion.base });
    }
  }, [active, pulse]);

  const bars = useMemo(
    () => Array.from({ length: BARS }, (_, i) => 0.2 + hashUnit(`${seed}:${i}`) * 0.8),
    [seed]
  );

  return (
    <View style={styles.wave}>
      {bars.map((h, i) => (
        <WaveBar key={i} base={h} index={i} pulse={pulse} />
      ))}
    </View>
  );
};

const WaveBar = ({
  base,
  index,
  pulse,
}: {
  base: number;
  index: number;
  pulse: SharedValue<number>;
}) => {
  const style = useAnimatedStyle(() => {
    'worklet';
    const phase = Math.sin(index * 0.7 + pulse.value * Math.PI * 2);
    const h = 3 + base * 22 * (0.35 + pulse.value * 0.65) * (0.6 + phase * 0.4 + 0.4);
    return { height: Math.max(3, h) };
  });
  return <Animated.View style={[styles.waveBar, style]} />;
};

type Props = {
  /** Called with the finished recording's local uri and length in seconds. */
  onCaptured: (uri: string, duration: number) => void;
  tint?: string;
};

export const VoiceRecorder = ({ onCaptured, tint = spectrum.confidence }: Props) => {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 120);
  const [granted, setGranted] = useState<boolean | null>(null);
  const ring = useSharedValue(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await AudioModule.requestRecordingPermissionsAsync();
        setGranted(res.granted);
        if (res.granted) {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        }
      } catch {
        setGranted(false);
      }
    })();
  }, []);

  const isRecording = recorderState.isRecording;

  useEffect(() => {
    ring.value = withSpring(isRecording ? 1 : 0, motion.springSoft);
  }, [isRecording, ring]);

  const start = useCallback(async () => {
    if (granted === false) {
      Alert.alert(
        'Microphone is off',
        'Riley needs microphone access to record a voice note. You can turn it on in Settings.'
      );
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert('Could not start recording', 'Something went wrong reaching the microphone.');
    }
  }, [granted, recorder]);

  const stop = useCallback(async () => {
    try {
      const seconds = Math.round((recorderState.durationMillis ?? 0) / 1000);
      await recorder.stop();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (recorder.uri) onCaptured(recorder.uri, seconds);
    } catch {
      Alert.alert('Could not save that recording', 'Give it another try.');
    }
  }, [recorder, recorderState.durationMillis, onCaptured]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + ring.value * 0.55,
    transform: [{ scale: 1 + ring.value * 0.22 }],
  }));

  return (
    <View style={styles.recorderRoot}>
      <View style={styles.recorderTop}>
        <Waveform active={isRecording} />
      </View>
      <View style={styles.recorderBottom}>
        <Text style={[type.caption, { color: isRecording ? tint : palette.inkFaint }]}>
          {isRecording
            ? formatClock((recorderState.durationMillis ?? 0) / 1000)
            : 'Tap to record a voice note'}
        </Text>
        <Pressable onPress={isRecording ? stop : start} hitSlop={12}>
          <View style={styles.micWrap}>
            <Animated.View
              style={[
                styles.micRing,
                { backgroundColor: tint, shadowColor: tint },
                ringStyle,
              ]}
            />
            <View style={[styles.micButton, isRecording && { backgroundColor: tint }]}>
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={22}
                color={isRecording ? '#FFFFFF' : palette.ink}
              />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

/** Compact playback row for a saved voice note. */
export const VoiceNotePlayer = ({
  uri,
  duration,
  tint = spectrum.confidence,
}: {
  uri: string;
  duration?: number;
  tint?: string;
}) => {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  const total = duration ?? (status.duration || 0);
  const progress = total > 0 ? Math.min(1, (status.currentTime || 0) / total) : 0;

  return (
    <View style={[clayTight, styles.player]}>
      <Pressable
        hitSlop={10}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (playing) {
            player.pause();
          } else {
            if (progress >= 0.999) player.seekTo(0);
            player.play();
          }
        }}
        style={[styles.playButton, { backgroundColor: tint }]}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={15} color="#FFFFFF" />
      </Pressable>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
      </View>
      <Text style={type.caption}>{formatClock(total)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  recorderRoot: { gap: space.md },
  recorderTop: { height: 40, justifyContent: 'center' },
  recorderBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: palette.inkGhost,
  },
  micWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  micRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  playButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,105,160,0.14)',
    overflow: 'hidden',
  },
  trackFill: { height: 4, borderRadius: 2 },
});
