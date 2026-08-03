import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useRouter } from 'expo-router';

import { Paper } from '@/components/Paper';
import { DateHeader, Rule, TextAction } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { MIN_TARGET, space } from '@/design/tokens';
import { EMOTIONS, EmotionKey } from '@/emotions/palette';
import { buildInsights, MIN_DAYS_FOR_INSIGHTS } from '@/insights/observe';
import { useDiary } from '@/store/DiaryProvider';

/**
 * Settings, and the only place statistics are allowed to be a number rather
 * than a feeling — and even here they are two quiet lines.
 */
export default function SettingsScreen() {
  const { c, t } = useTheme();
  const router = useRouter();
  const {
    loggedDays,
    entries,
    orbFor,
    noteFor,
    nameOf,
    settings,
    renameEmotion,
    updateSettings,
    resetAll,
    clearEverything,
  } = useDiary();

  const insights = useMemo(
    () =>
      settings.insights
        ? buildInsights({ days: loggedDays, orbFor, noteFor, nameOf })
        : [],
    [settings.insights, loggedDays, orbFor, noteFor, nameOf]
  );

  const rename = (key: EmotionKey) => {
    const current = settings.renames[key] ?? '';
    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        `Rename ${nameOf(key)}`,
        'Colours mean different things to different people.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: () => renameEmotion(key, null) },
          { text: 'Save', onPress: (v?: string) => renameEmotion(key, v ?? null) },
        ],
        'plain-text',
        current
      );
    } else {
      Alert.alert('Renaming colours is available on iOS in this build.');
    }
  };

  const confirmReset = () =>
    Alert.alert('Start over?', 'This clears every orb and everything you have written.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: () => clearEverything() },
      { text: 'Refill with sample days', onPress: () => resetAll() },
    ]);

  return (
    <Paper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <DateHeader meta="Settings" />

        {/* Quiet record. Two lines, no cards, no charts. */}
        <View style={styles.record}>
          <Text style={t('body', { color: c.inkSoft })}>
            {loggedDays.length} {loggedDays.length === 1 ? 'day' : 'days'} kept
          </Text>
          {entries.length ? (
            <Text style={t('body', { color: c.inkSoft })}>
              {entries.length} {entries.length === 1 ? 'attachment' : 'attachments'}
            </Text>
          ) : null}
        </View>

        <Section title="Noticing" />
        <View style={styles.switchRow}>
          <Text style={[t('body'), { flex: 1 }]}>Gentle observations</Text>
          <Switch
            value={settings.insights}
            onValueChange={(v) => updateSettings({ insights: v })}
            accessibilityLabel="Gentle observations"
            trackColor={{ true: c.accent, false: c.lineStrong }}
          />
        </View>

        {settings.insights ? (
          insights.length ? (
            <View style={styles.insights}>
              {insights.map((line) => (
                <Text key={line} style={t('quote', { color: c.inkSoft })}>
                  {line}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={[t('caption', { color: c.inkFaint }), styles.note]}>
              Observations appear once there are about {MIN_DAYS_FOR_INSIGHTS} days to read.
            </Text>
          )
        ) : null}

        <Section title="Your colours" />
        <Text style={[t('caption', { color: c.inkFaint }), styles.note]}>
          These names are only a starting point. Rename any of them.
        </Text>
        <View style={styles.colours}>
          {EMOTIONS.map((e, i) => (
            <View key={e.key}>
              {i > 0 ? <Rule /> : null}
              <Pressable
                onPress={() => rename(e.key)}
                accessibilityRole="button"
                accessibilityLabel={`Rename ${nameOf(e.key)}, currently ${e.pigment}`}
                style={styles.colourRow}
              >
                <View style={[styles.swatch, { backgroundColor: e.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={t('body')}>{nameOf(e.key)}</Text>
                  <Text style={t('caption', { color: c.inkFaint })}>{e.pigment}</Text>
                </View>
                <Ionicons name="pencil-outline" size={15} color={c.inkFaint} />
              </Pressable>
            </View>
          ))}
        </View>

        <Section title="Keepsakes" />
        <TextAction
          label="Make a keepsake from today"
          onPress={() => router.push('/keepsake')}
        />

        <Section title="Data" />
        <Text style={[t('caption', { color: c.inkFaint }), styles.note]}>
          Everything stays on this phone. Nothing is uploaded.
        </Text>
        <TextAction label="See the opening again" onPress={() => router.push('/onboarding')} />
        <Pressable
          onPress={confirmReset}
          accessibilityRole="button"
          accessibilityLabel="Erase everything"
          style={styles.dangerRow}
        >
          <Text style={t('body', { color: c.danger })}>Erase everything</Text>
        </Pressable>
      </ScrollView>
    </Paper>
  );
}

const Section = ({ title }: { title: string }) => {
  const { c, t } = useTheme();
  return (
    <Text style={[t('meta', { color: c.inkFaint }), styles.section]} accessibilityRole="header">
      {title.toUpperCase()}
    </Text>
  );
};

const styles = StyleSheet.create({
  content: { paddingTop: space.md, paddingBottom: space.xxl },
  record: { marginTop: space.lg, gap: 2 },
  section: { marginTop: space.xl, marginBottom: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TARGET },
  insights: { gap: space.sm, marginTop: space.sm },
  note: { marginTop: space.xs },
  colours: { marginTop: space.md },
  colourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
  },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  dangerRow: { minHeight: MIN_TARGET, justifyContent: 'center', marginTop: space.sm },
});
