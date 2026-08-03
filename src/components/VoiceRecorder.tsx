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
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { MIN_TARGET, motion, radius, space } from '@/design/tokens';
import { hashUnit } from '@/utils/id';

const BARS = 28;

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

const WaveBar = ({
  base,
  index,
  pulse,
  color,
}: {
  base: number;
  index: number;
  pulse: SharedValue<number>;
  color: string;
}) => {
  const style = useAnimatedStyle(() => {
    'worklet';
    const phase = Math.sin(index * 0.6 + pulse.value * Math.PI * 2);
    return { height: Math.max(2, 2 + base * 16 * (0.3 + pulse.value * 0.7) * (0.7 + phase * 0.3)) };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
};

/** A voice note, recorded in place. Nothing about it is celebratory. */
export const VoiceRecorder = ({
  onCaptured,
}: {
  onCaptured: (uri: string, duration: number) => void;
}) => {
  const { c, t, reduceMotion } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 140);
  const [granted, setGranted] = useState<boolean | null>(null);
  const pulse = useSharedValue(0);

  const recording = state.isRecording;

  useEffect(() => {
    (async () => {
      try {
        const res = await AudioModule.requestRecordingPermissionsAsync();
        setGranted(res.granted);
        if (res.granted) await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      } catch {
        setGranted(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (recording && !reduceMotion) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(0, { duration: motion.control });
    }
  }, [recording, reduceMotion, pulse]);

  const bars = useMemo(
    () => Array.from({ length: BARS }, (_, i) => 0.25 + hashUnit(`b${i}`) * 0.75),
    []
  );

  const start = useCallback(async () => {
    if (granted === false) {
      Alert.alert('Microphone is off', 'Riley needs the microphone to record a voice note.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert('Could not start recording');
    }
  }, [granted, recorder]);

  const stop = useCallback(async () => {
    try {
      const seconds = Math.round((state.durationMillis ?? 0) / 1000);
      await recorder.stop();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (recorder.uri) onCaptured(recorder.uri, seconds);
    } catch {
      Alert.alert('Could not save that recording');
    }
  }, [recorder, state.durationMillis, onCaptured]);

  return (
    <View style={[styles.recorder, { borderColor: c.line }]}>
      <View style={styles.wave}>
        {bars.map((h, i) => (
          <WaveBar key={i} base={h} index={i} pulse={pulse} color={recording ? c.accent : c.lineStrong} />
        ))}
      </View>
      <Text style={t('caption', { color: recording ? c.ink : c.inkFaint })}>
        {recording ? clock((state.durationMillis ?? 0) / 1000) : 'Voice note'}
      </Text>
      <Pressable
        onPress={recording ? stop : start}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        hitSlop={10}
        style={[
          styles.mic,
          { backgroundColor: recording ? c.ink : 'transparent', borderColor: recording ? c.ink : c.lineStrong },
        ]}
      >
        <Ionicons name={recording ? 'stop' : 'mic-outline'} size={18} color={recording ? c.canvas : c.ink} />
      </Pressable>
    </View>
  );
};

/** Playback for a saved note. */
export const VoiceNotePlayer = ({ uri, duration }: { uri: string; duration?: number }) => {
  const { c, t } = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const total = duration ?? status.duration ?? 0;
  const progress = total > 0 ? Math.min(1, (status.currentTime || 0) / total) : 0;

  return (
    <View style={styles.player}>
      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice note' : 'Play voice note'}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (status.playing) player.pause();
          else {
            if (progress >= 0.999) player.seekTo(0);
            player.play();
          }
        }}
        style={[styles.play, { borderColor: c.lineStrong }]}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={14} color={c.ink} />
      </Pressable>
      <View style={[styles.track, { backgroundColor: c.lineStrong }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: c.ink }]} />
      </View>
      <Text style={t('caption', { color: c.inkFaint })}>{clock(total)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  recorder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, height: 22 },
  bar: { width: 2, borderRadius: 1 },
  mic: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: MIN_TARGET / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TARGET },
  play: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden' },
  fill: { height: 2, borderRadius: 1 },
});
