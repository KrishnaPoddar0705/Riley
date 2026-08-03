import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { EmotionalOrb } from '@/components/EmotionalOrb';
import { Paper } from '@/components/Paper';
import { IconButton, QuietButton } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { fonts, MIN_TARGET, radius, space } from '@/design/tokens';
import { useDiary } from '@/store/DiaryProvider';
import { describeOrb, isBlank } from '@/store/orb';
import { formatLong, lastDays, todayKey } from '@/utils/date';

type Shape = 'day' | 'week';
type Include = 'orb' | 'feelings' | 'words';

/**
 * A keepsake.
 *
 * The orb is the only thing worth sharing, so the card is mostly orb. Private
 * writing is never included unless the user explicitly turns it on, and the
 * default is the quietest option.
 */
export default function KeepsakeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t } = useTheme();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? todayKey();

  const { orbFor, noteFor, nameOf } = useDiary();
  const card = useRef<View>(null);

  const [shape, setShape] = useState<Shape>('day');
  const [include, setInclude] = useState<Include>('feelings');
  const [busy, setBusy] = useState(false);

  const orb = orbFor(day);
  const note = noteFor(day);
  const week = useMemo(() => lastDays(7, day).map((d) => ({ d, orb: orbFor(d) })), [day, orbFor]);

  const cardW = Math.min(width - space.lg * 2, 340);
  const cardH = cardW * (16 / 9) * 0.62;

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing is not available on this device.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Keepsake' });
    } catch {
      Alert.alert('Could not make that keepsake', 'Give it another try.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper edges={['top', 'bottom']} padded={false}>
      <View style={styles.bar}>
        <IconButton label="Close" onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={c.ink} />
        </IconButton>
        <Text style={t('label', { color: c.inkSoft })}>Keepsake</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* What actually gets exported. */}
        <View
          ref={card}
          collapsable={false}
          style={[styles.card, { width: cardW, height: cardH, backgroundColor: c.canvas }]}
        >
          {shape === 'day' ? (
            <>
              <EmotionalOrb orb={orb} size={cardW * 0.52} placeholder={isBlank(orb)} />
              <Text style={[t('meta', { color: c.inkFaint }), styles.cardMeta]}>
                {formatLong(day).toUpperCase()}
              </Text>
              {include !== 'orb' && !isBlank(orb) ? (
                <Text style={[t('quote', { color: c.inkSoft }), styles.cardLine]} numberOfLines={2}>
                  {describeOrb(orb!, nameOf)}
                </Text>
              ) : null}
              {include === 'words' && note.text ? (
                <Text style={[t('body', { color: c.ink }), styles.cardWords]} numberOfLines={3}>
                  “{note.text}”
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[t('meta', { color: c.inkFaint }), { marginBottom: space.lg }]}>
                MY WEEK IN COLOUR
              </Text>
              <View style={styles.weekRow}>
                {week.map(({ d, orb: o }) => (
                  <View key={d} style={styles.weekCell}>
                    <EmotionalOrb
                      orb={o}
                      size={cardW * 0.1}
                      glow={false}
                      placeholder={isBlank(o)}
                      detail="simple"
                    />
                    <Text style={t('caption', { fontSize: 9, color: c.inkFaint })}>
                      {new Date(d).toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </Text>
                  </View>
                ))}
              </View>
              {include === 'words' && note.text ? (
                <Text style={[t('quote', { color: c.inkSoft }), styles.cardLine]} numberOfLines={2}>
                  “{note.text}”
                </Text>
              ) : null}
            </>
          )}

          <Text style={[styles.mark, { color: c.inkFaint, fontFamily: fonts.serif }]}>Riley</Text>
        </View>

        <Text style={[t('meta', { color: c.inkFaint }), styles.label]}>SHAPE</Text>
        <View style={styles.chips}>
          <Chip label="This day" active={shape === 'day'} onPress={() => setShape('day')} />
          <Chip label="This week" active={shape === 'week'} onPress={() => setShape('week')} />
        </View>

        <Text style={[t('meta', { color: c.inkFaint }), styles.label]}>WHAT TO INCLUDE</Text>
        <View style={styles.chips}>
          <Chip label="Orb only" active={include === 'orb'} onPress={() => setInclude('orb')} />
          <Chip
            label="With feelings"
            active={include === 'feelings'}
            onPress={() => setInclude('feelings')}
          />
          <Chip label="With my words" active={include === 'words'} onPress={() => setInclude('words')} />
        </View>

        <Text style={[t('caption', { color: c.inkFaint }), styles.privacy]}>
          Nothing you wrote is included unless you choose “With my words”.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <QuietButton
          label={busy ? 'Preparing…' : 'Share'}
          tone="primary"
          disabled={busy}
          onPress={share}
        />
      </View>
    </Paper>
  );
}

const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  const { c, t } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        { borderColor: active ? c.ink : c.line, backgroundColor: active ? c.accentSoft : 'transparent' },
      ]}
    >
      <Text style={t('label', { color: active ? c.ink : c.inkSoft })}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl },
  card: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    padding: space.xl,
  },
  cardMeta: { marginTop: space.xl },
  cardLine: { marginTop: space.sm, textAlign: 'center' },
  cardWords: { marginTop: space.md, textAlign: 'center' },
  weekRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  weekCell: { alignItems: 'center', gap: 6 },
  mark: { position: 'absolute', bottom: space.lg, fontSize: 13, fontStyle: 'italic' },
  label: { marginTop: space.xl, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  privacy: { marginTop: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
});
