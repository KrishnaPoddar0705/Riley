import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/design/theme';
import { MIN_TARGET, radius, space } from '@/design/tokens';
import { EMOTIONS, EmotionKey, emotionColor } from '@/emotions/palette';
import type { Feeling, Orb, Placement } from '@/store/orb';
import { MAX_FEELINGS, PLACEMENTS, PRESENCE, makeFeeling } from '@/store/orb';
import { Rule, TextAction } from './Primitives';

/** The eight offered up front. The rest live behind "More feelings". */
const QUICK: EmotionKey[] = [
  'calm',
  'joy',
  'gratitude',
  'love',
  'anxiety',
  'fatigue',
  'sadness',
  'hope',
];

/* -------------------------------------------------------------------------- */

/** A named colour. Tapping it is the whole interaction. */
export const FeelingChip = ({
  emotion,
  name,
  selected,
  onPress,
  size = 'normal',
}: {
  emotion: EmotionKey;
  name: string;
  selected?: boolean;
  onPress: () => void;
  size?: 'normal' | 'small';
}) => {
  const { c, t } = useTheme();
  const d = size === 'small' ? 16 : 20;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={name}
      style={[
        styles.chip,
        {
          borderColor: selected ? c.ink : c.line,
          backgroundColor: selected ? c.accentSoft : 'transparent',
        },
      ]}
    >
      <View
        style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: emotionColor(emotion) }}
      />
      <Text style={t('label', { color: selected ? c.ink : c.inkSoft })}>{name}</Text>
    </Pressable>
  );
};

/* -------------------------------------------------------------------------- */

/** Full list, opened only when the eight are not enough. */
const AllFeelings = ({
  visible,
  onClose,
  onPick,
  nameOf,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (k: EmotionKey) => void;
  nameOf: (k: EmotionKey) => string;
}) => {
  const { c, t } = useTheme();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EMOTIONS.filter((e) => !s || nameOf(e.key).toLowerCase().includes(s));
  }, [q, nameOf]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: c.canvas }]}>
        <View style={styles.sheetBar}>
          <Text style={t('heading')}>All feelings</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
            <Ionicons name="close" size={22} color={c.ink} />
          </Pressable>
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={c.inkFaint}
          style={[t('body'), styles.search, { color: c.ink, borderColor: c.line }]}
          accessibilityLabel="Search feelings"
        />
        <ScrollView contentContainerStyle={styles.sheetList}>
          {list.map((e) => (
            <View key={e.key}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onPick(e.key);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={nameOf(e.key)}
                style={styles.sheetRow}
              >
                <View style={[styles.sheetSwatch, { backgroundColor: e.color }]} />
                <Text style={[t('body'), { flex: 1 }]}>{nameOf(e.key)}</Text>
              </Pressable>
              <Rule />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */

type Props = {
  orb: Orb;
  onChange: (next: Orb) => void;
  nameOf: (k: EmotionKey) => string;
};

/**
 * How a day gets described.
 *
 * Pick the feeling that was most present, then say whether anything was sitting
 * underneath it. Nothing here is a tool: no brush, no percentage, no canvas.
 * The words on screen are the words a person would use.
 */
export const FeelingComposer = ({ orb, onChange, nameOf }: Props) => {
  const { c, t, reduceMotion } = useTheme();
  const [browsing, setBrowsing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const lead = orb.feelings[0];

  const setLead = (k: EmotionKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!lead) {
      onChange({ ...orb, feelings: [makeFeeling(k, 'surface', PRESENCE[2].value, orb.day)] });
      return;
    }
    onChange({
      ...orb,
      feelings: orb.feelings.map((f) => (f.id === lead.id ? { ...f, emotion: k } : f)),
    });
  };

  const addFeeling = (k: EmotionKey) => {
    if (orb.feelings.length >= MAX_FEELINGS) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const f = makeFeeling(k, 'core', PRESENCE[1].value, orb.day);
    onChange({ ...orb, feelings: [...orb.feelings, f] });
    setEditingId(f.id);
  };

  const update = (id: string, patch: Partial<Feeling>) => {
    Haptics.selectionAsync().catch(() => {});
    onChange({ ...orb, feelings: orb.feelings.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  };

  const remove = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onChange({ ...orb, feelings: orb.feelings.filter((f) => f.id !== id) });
    setEditingId(null);
  };

  /* ---- step one: nothing chosen yet ----------------------------------- */
  if (!lead) {
    return (
      <View>
        <Text style={[t('heading'), styles.prompt]}>What feeling was most present today?</Text>
        <View style={styles.chips}>
          {QUICK.map((k) => (
            <FeelingChip key={k} emotion={k} name={nameOf(k)} onPress={() => setLead(k)} />
          ))}
        </View>
        <TextAction label="More feelings" onPress={() => setBrowsing(true)} />
        <AllFeelings
          visible={browsing}
          onClose={() => setBrowsing(false)}
          onPick={setLead}
          nameOf={nameOf}
        />
      </View>
    );
  }

  const others = orb.feelings.slice(1);

  /* ---- step two: anything underneath? ---------------------------------- */
  return (
    <View>
      <Text style={[t('meta', { color: c.inkFaint }), styles.section]}>MOST PRESENT</Text>
      <View style={styles.chips}>
        {QUICK.map((k) => (
          <FeelingChip
            key={k}
            emotion={k}
            name={nameOf(k)}
            selected={lead.emotion === k}
            onPress={() => setLead(k)}
          />
        ))}
        {!QUICK.includes(lead.emotion) ? (
          <FeelingChip emotion={lead.emotion} name={nameOf(lead.emotion)} selected onPress={() => {}} />
        ) : null}
      </View>
      <TextAction label="More feelings" onPress={() => setBrowsing(true)} />

      <PresenceRow
        label="How much of the day?"
        value={lead.presence}
        onChange={(v) => update(lead.id, { presence: v })}
      />

      <Rule style={{ marginVertical: space.lg }} />

      <Text style={[t('heading'), styles.prompt]}>Was there anything else underneath?</Text>

      <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(220)}>
        {others.map((f) => (
          <Animated.View
            key={f.id}
            entering={reduceMotion ? undefined : FadeIn.duration(200)}
            exiting={reduceMotion ? undefined : FadeOut.duration(160)}
          >
            <Pressable
              onPress={() => setEditingId((id) => (id === f.id ? null : f.id))}
              accessibilityRole="button"
              accessibilityLabel={`${nameOf(f.emotion)}, ${
                PLACEMENTS.find((p) => p.key === f.place)?.label
              }. Adjust`}
              style={styles.layerRow}
            >
              <View style={[styles.layerDot, { backgroundColor: emotionColor(f.emotion) }]} />
              <View style={{ flex: 1 }}>
                <Text style={t('body')}>{nameOf(f.emotion)}</Text>
                <Text style={t('caption', { color: c.inkFaint })}>
                  {PLACEMENTS.find((p) => p.key === f.place)?.label} ·{' '}
                  {PRESENCE.reduce((a, b) =>
                    Math.abs(b.value - f.presence) < Math.abs(a.value - f.presence) ? b : a
                  ).label.toLowerCase()}
                </Text>
              </View>
              <Ionicons
                name={editingId === f.id ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={c.inkFaint}
              />
            </Pressable>

            {editingId === f.id ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(180)}
                style={styles.layerEdit}
              >
                <Text style={[t('meta', { color: c.inkFaint }), styles.section]}>WHERE IT SAT</Text>
                <View style={styles.chips}>
                  {PLACEMENTS.map((p) => (
                    <Pressable
                      key={p.key}
                      onPress={() => update(f.id, { place: p.key as Placement })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: f.place === p.key }}
                      accessibilityLabel={`${p.label}. ${p.blurb}`}
                      style={[
                        styles.chip,
                        {
                          borderColor: f.place === p.key ? c.ink : c.line,
                          backgroundColor: f.place === p.key ? c.accentSoft : 'transparent',
                        },
                      ]}
                    >
                      <Text style={t('label', { color: f.place === p.key ? c.ink : c.inkSoft })}>
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <PresenceRow
                  label="How much?"
                  value={f.presence}
                  onChange={(v) => update(f.id, { presence: v })}
                />

                <TextAction label={`Remove ${nameOf(f.emotion).toLowerCase()}`} onPress={() => remove(f.id)} />
              </Animated.View>
            ) : null}
            <Rule />
          </Animated.View>
        ))}
      </Animated.View>

      {orb.feelings.length < MAX_FEELINGS ? (
        <View style={styles.chips}>
          {QUICK.filter((k) => !orb.feelings.some((f) => f.emotion === k)).slice(0, 6).map((k) => (
            <FeelingChip
              key={k}
              emotion={k}
              name={nameOf(k)}
              size="small"
              onPress={() => addFeeling(k)}
            />
          ))}
        </View>
      ) : (
        <Text style={[t('caption', { color: c.inkFaint }), { marginTop: space.sm }]}>
          Four feelings is plenty for one day.
        </Text>
      )}

      {/* Did it resolve? One tap, no slider. */}
      <Rule style={{ marginVertical: space.lg }} />
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onChange({ ...orb, clarity: orb.clarity > 0.5 ? 0.2 : 0.75 });
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: orb.clarity <= 0.5 }}
        accessibilityLabel="The day never quite settled"
        style={styles.settleRow}
      >
        <Ionicons
          name={orb.clarity <= 0.5 ? 'checkbox' : 'square-outline'}
          size={20}
          color={orb.clarity <= 0.5 ? c.accent : c.inkFaint}
        />
        <Text style={[t('body'), { flex: 1 }]}>It never quite settled</Text>
      </Pressable>

      <AllFeelings
        visible={browsing}
        onClose={() => setBrowsing(false)}
        onPick={(k) => (orb.feelings.length ? addFeeling(k) : setLead(k))}
        nameOf={nameOf}
      />
    </View>
  );
};

/* -------------------------------------------------------------------------- */

const PresenceRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) => {
  const { c, t } = useTheme();
  const nearest = PRESENCE.reduce((a, b) =>
    Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a
  );
  return (
    <View style={styles.presence}>
      <Text style={[t('meta', { color: c.inkFaint }), styles.section]}>{label.toUpperCase()}</Text>
      <View style={styles.chips}>
        {PRESENCE.map((p) => {
          const on = p.value === nearest.value;
          return (
            <Pressable
              key={p.label}
              onPress={() => onChange(p.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={p.label}
              style={[
                styles.chip,
                { borderColor: on ? c.ink : c.line, backgroundColor: on ? c.accentSoft : 'transparent' },
              ]}
            >
              <Text style={t('label', { color: on ? c.ink : c.inkSoft })}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  prompt: { marginBottom: space.md },
  section: { marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: MIN_TARGET,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  presence: { marginTop: space.lg },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
  layerDot: { width: 20, height: 20, borderRadius: 10 },
  layerEdit: { paddingBottom: space.md, gap: space.sm },
  settleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TARGET },
  sheet: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg },
  sheetBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.md,
    marginTop: space.md,
  },
  sheetList: { paddingBottom: space.xxl },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  sheetSwatch: { width: 22, height: 22, borderRadius: 11 },
});
