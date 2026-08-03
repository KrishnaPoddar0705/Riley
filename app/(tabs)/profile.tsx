import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { pickMedia } from '@/components/Capture';
import { ClayCard, GlassButton, PressableCard } from '@/components/Clay';
import { buildGlobeNodes, EmotionGlobe } from '@/components/EmotionGlobe';
import { Screen, Starfield } from '@/components/Screen';
import { emotionColor, emotionLabel } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import { clay, clayTight, palette, radius, space, spectrum, type } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, updateProfile, streak, moods, entries, entriesFor, todayMood, resetAll } =
    useDiary();

  const tint = todayMood ? emotionColor(todayMood.emotion) : spectrum.confidence;

  const nodes = useMemo(
    () => buildGlobeNodes(moods, (d) => entriesFor(d).length > 0, 180),
    [moods, entriesFor]
  );

  const changeAvatar = async () => {
    const picked = await pickMedia('photo');
    if (picked[0]) updateProfile({ avatarUri: picked[0].uri });
  };

  const renameProfile = () => {
    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'What should Riley call you?',
        undefined,
        (text) => {
          const next = text.trim();
          if (next) updateProfile({ name: next.slice(0, 24) });
        },
        'plain-text',
        profile.name
      );
    } else {
      Alert.alert('Name', 'Rename is available on iOS in this build.');
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Start over?',
      'This clears everything you have saved and refills Riley with sample days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            resetAll();
          },
        },
      ]
    );
  };

  const globeSize = Math.min(width * 0.86, 360);

  return (
    <Screen tint={tint}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.headRow}>
          <GlassButton onPress={confirmReset}>
            <Ionicons name="settings-outline" size={18} color={palette.ink} />
          </GlassButton>

          <View style={styles.avatarWrap}>
            <PressableCard onPress={changeAvatar} style={styles.avatar}>
              {profile.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={type.script(44)}>{profile.name.slice(0, 1)}</Text>
              )}
            </PressableCard>
            <PressableCard onPress={changeAvatar} style={styles.pencil}>
              <Ionicons name="pencil" size={12} color={palette.ink} />
            </PressableCard>
          </View>

          <GlassButton onPress={() => router.push('/check-in')}>
            <Ionicons name="notifications-outline" size={18} color={palette.ink} />
          </GlassButton>
        </Animated.View>

        <PressableCard onPress={renameProfile} haptic={false} style={styles.nameRow}>
          <Text style={[type.heading, { fontSize: 21 }]}>{profile.name}</Text>
          <Ionicons name="chevron-forward" size={14} color={palette.inkGhost} />
        </PressableCard>

        <Animated.View entering={FadeInDown.delay(80).duration(420)}>
          <View style={[clay, styles.night]}>
            <Starfield count={30} seed="profile" />
            <View style={styles.nightRow}>
              <View style={styles.nightStat}>
                <Text style={styles.nightValue}>{profile.friends}</Text>
                <Text style={styles.nightLabel}>Friends</Text>
              </View>
              <View style={styles.nightDivider} />
              <View style={styles.nightStat}>
                <View style={styles.streakRow}>
                  <Text style={styles.nightValue}>{streak}</Text>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                </View>
                <Text style={styles.nightLabel}>Streak</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(420)} style={styles.globeBlock}>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {todayMood
              ? `Today's mood is saved · ${emotionLabel(todayMood.emotion)}`
              : 'Today has no colour yet'}
          </Text>
          <EmotionGlobe
            nodes={nodes}
            size={globeSize}
            idleSpeed={0.1}
            orbSize={Math.max(10, globeSize * 0.055)}
            onSelect={(day) => router.push(`/day/${day}`)}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(420)}>
          <ClayCard style={styles.summary}>
            <View style={styles.summaryRow}>
              <SummaryCell value={String(Object.keys(moods).length)} label="days coloured" />
              <View style={styles.summaryDivider} />
              <SummaryCell value={String(entries.length)} label="things saved" />
              <View style={styles.summaryDivider} />
              <SummaryCell
                value={String(entries.filter((e) => e.attachments.length > 0).length)}
                label="with media"
              />
            </View>
          </ClayCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(420)} style={{ gap: space.sm }}>
          <Row
            icon="sparkles-outline"
            label="Check in for today"
            onPress={() => router.push('/check-in')}
            tint={tint}
          />
          <Row
            icon="add-circle-outline"
            label="Save something new"
            onPress={() => router.push('/compose')}
            tint={spectrum.calm}
          />
          <Row
            icon="planet-outline"
            label="Open the globe"
            onPress={() => router.push('/globe')}
            tint={spectrum.love}
          />
          <Row
            icon="refresh-outline"
            label="Reset Riley"
            onPress={confirmReset}
            tint={spectrum.anger}
          />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const SummaryCell = ({ value, label }: { value: string; label: string }) => (
  <View style={styles.summaryCell}>
    <Text style={[type.heading, { fontSize: 19, fontStyle: 'italic' }]}>{value}</Text>
    <Text style={type.caption}>{label}</Text>
  </View>
);

const Row = ({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint: string;
}) => (
  <PressableCard onPress={onPress} style={styles.row}>
    <View style={[styles.rowIcon, { backgroundColor: `${tint}1F` }]}>
      <Ionicons name={icon} size={17} color={tint} />
    </View>
    <Text style={[type.label, { color: palette.ink, flex: 1 }]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={palette.inkGhost} />
  </PressableCard>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.md, paddingBottom: 120, gap: space.md },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.md,
  },
  avatarWrap: { alignItems: 'center' },
  avatar: {
    width: 106,
    height: 106,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    overflow: 'hidden',
    ...clay,
  },
  avatarImage: { width: '100%', height: '100%' },
  pencil: {
    position: 'absolute',
    bottom: -12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...clayTight,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: space.md,
  },
  night: {
    borderRadius: radius.xl,
    backgroundColor: palette.night,
    overflow: 'hidden',
    paddingVertical: space.lg,
  },
  nightRow: { flexDirection: 'row', alignItems: 'center' },
  nightStat: { flex: 1, alignItems: 'center', gap: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nightValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', fontStyle: 'italic' },
  nightLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.4 },
  nightDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: 'rgba(255,255,255,0.2)' },
  globeBlock: { alignItems: 'center', gap: space.sm },
  summary: { borderRadius: radius.lg, paddingVertical: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryCell: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: palette.edge },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clayTight,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
