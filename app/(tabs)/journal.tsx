import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { EmotionalOrb } from '@/components/EmotionalOrb';
import { JournalEntryRow } from '@/components/JournalEntryRow';
import { Paper } from '@/components/Paper';
import { DateHeader, IconButton, QuietButton, Rule, TextAction } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { MIN_TARGET, radius, space } from '@/design/tokens';
import { EMOTIONS, EmotionKey } from '@/emotions/palette';
import { useDiary } from '@/store/DiaryProvider';
import { isBlank } from '@/store/orb';
import { fromDayKey, monthMatrix, monthTitle, todayKey, WEEKDAYS_MIN } from '@/utils/date';

type Mode = 'timeline' | 'calendar';
type Attach = 'any' | 'photos' | 'voice';

/**
 * The journal: a quiet archive.
 *
 * Search, calendar and filter are three icons. Everything else lives in a sheet,
 * so the top of the screen is never a row of category chips.
 */
export default function JournalScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t } = useTheme();
  const { orbFor, noteFor, entriesFor, nameOf, loggedDays, entries } = useDiary();

  const [mode, setMode] = useState<Mode>('timeline');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [filtering, setFiltering] = useState(false);
  const [emotion, setEmotion] = useState<EmotionKey | null>(null);
  const [attach, setAttach] = useState<Attach>('any');

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const days = useMemo(() => {
    const set = new Set<string>(loggedDays);
    for (const e of entries) set.add(e.day);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [loggedDays, entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return days.filter((day) => {
      if (emotion) {
        const orb = orbFor(day);
        if (isBlank(orb) || !orb!.feelings.some((f) => f.emotion === emotion)) return false;
      }
      if (attach !== 'any') {
        const kind = attach === 'photos' ? 'photo' : 'voice';
        if (!entriesFor(day).some((e) => e.attachments.some((a) => a.kind === kind))) return false;
      }
      if (!q) return true;
      const n = noteFor(day);
      const hay = [n.title, n.text, n.bright, n.difficult, ...entriesFor(day).map((e) => e.text)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [days, query, emotion, attach, orbFor, noteFor, entriesFor]);

  const filtered = !!emotion || attach !== 'any';
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const cell = Math.floor((width - space.lg * 2) / 7);

  const stepMonth = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setCursor((cur) => {
      const d = new Date(cur.year, cur.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const isFuture =
    cursor.year > now.getFullYear() ||
    (cursor.year === now.getFullYear() && cursor.month >= now.getMonth());

  return (
    <Paper>
      <View style={styles.head}>
        <DateHeader meta="Journal" />
        <View style={styles.actions}>
          <IconButton
            label={searching ? 'Close search' : 'Search'}
            onPress={() => {
              setSearching((s) => !s);
              if (searching) setQuery('');
            }}
          >
            <Ionicons name={searching ? 'close' : 'search'} size={18} color={c.inkSoft} />
          </IconButton>
          <IconButton
            label={mode === 'timeline' ? 'Show calendar' : 'Show timeline'}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setMode((m) => (m === 'timeline' ? 'calendar' : 'timeline'));
            }}
          >
            <Ionicons
              name={mode === 'timeline' ? 'calendar-outline' : 'list-outline'}
              size={18}
              color={c.inkSoft}
            />
          </IconButton>
          <IconButton label="Filter" onPress={() => setFiltering(true)}>
            <Ionicons
              name={filtered ? 'funnel' : 'funnel-outline'}
              size={17}
              color={filtered ? c.ink : c.inkSoft}
            />
          </IconButton>
        </View>
      </View>

      {searching ? (
        <View style={[styles.search, { borderColor: c.line }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search what you wrote"
            placeholderTextColor={c.inkFaint}
            style={[t('body'), { flex: 1, color: c.ink }]}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search journal"
          />
        </View>
      ) : null}

      {mode === 'timeline' ? (
        <FlatList
          data={visible}
          keyExtractor={(d) => d}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <Rule />}
          renderItem={({ item }) => (
            <JournalEntryRow
              day={item}
              orb={orbFor(item)}
              note={noteFor(item)}
              entries={entriesFor(item)}
              nameOf={nameOf}
              onPress={() => router.push(`/day/${item}`)}
            />
          )}
          ListEmptyComponent={
            <Text style={[t('body', { color: c.inkFaint }), styles.empty]}>
              {query || filtered ? 'Nothing matches that.' : 'Your days will collect here.'}
            </Text>
          }
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <View style={styles.monthBar}>
            <IconButton label="Previous month" onPress={() => stepMonth(-1)}>
              <Ionicons name="chevron-back" size={18} color={c.inkSoft} />
            </IconButton>
            <Text style={t('heading')}>{monthTitle(cursor.year, cursor.month)}</Text>
            <IconButton
              label="Next month"
              onPress={() => !isFuture && stepMonth(1)}
              style={{ opacity: isFuture ? 0.25 : 1 }}
            >
              <Ionicons name="chevron-forward" size={18} color={c.inkSoft} />
            </IconButton>
          </View>

          <View style={styles.weekHead}>
            {WEEKDAYS_MIN.map((d, i) => (
              <View key={i} style={{ width: cell, alignItems: 'center' }}>
                <Text style={t('caption', { color: c.inkFaint })}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`p${i}`} style={{ width: cell, height: cell + 14 }} />;
              const orb = orbFor(day);
              const blank = isBlank(orb);
              const isToday = day === todayKey();
              const d = Math.round(cell * 0.62);
              return (
                <Pressable
                  key={day}
                  onPress={() => router.push(`/day/${day}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${fromDayKey(day).getDate()}${blank ? ', not coloured' : ''}`}
                  style={{ width: cell, height: cell + 14, alignItems: 'center' }}
                >
                  {blank ? (
                    <View style={{ height: d }} />
                  ) : (
                    // Real mixed orbs in the grid, not flat dots.
                    <EmotionalOrb orb={orb} size={d} glow={false} />
                  )}
                  <Text
                    style={t('caption', {
                      fontSize: 11,
                      marginTop: 4,
                      color: isToday ? c.ink : c.inkFaint,
                      fontWeight: isToday ? '700' : '400',
                    })}
                  >
                    {fromDayKey(day).getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Filters live here, not across the top of the screen. */}
      <Modal
        visible={filtering}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFiltering(false)}
      >
        <View style={[styles.sheet, { backgroundColor: c.canvas }]}>
          <View style={styles.sheetBar}>
            <Text style={t('heading')}>Filter</Text>
            <IconButton label="Close" onPress={() => setFiltering(false)}>
              <Ionicons name="close" size={22} color={c.ink} />
            </IconButton>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
            <Text style={[t('meta', { color: c.inkFaint }), styles.sheetLabel]}>FEELING</Text>
            <View style={styles.chips}>
              <FilterChip label="Any" active={!emotion} onPress={() => setEmotion(null)} />
              {EMOTIONS.map((e) => (
                <FilterChip
                  key={e.key}
                  label={nameOf(e.key)}
                  color={e.color}
                  active={emotion === e.key}
                  onPress={() => setEmotion((f) => (f === e.key ? null : e.key))}
                />
              ))}
            </View>

            <Text style={[t('meta', { color: c.inkFaint }), styles.sheetLabel]}>CONTAINS</Text>
            <View style={styles.chips}>
              {(['any', 'photos', 'voice'] as Attach[]).map((a) => (
                <FilterChip
                  key={a}
                  label={a === 'any' ? 'Anything' : a === 'photos' ? 'Photos' : 'Voice notes'}
                  active={attach === a}
                  onPress={() => setAttach(a)}
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.sheetFoot}>
            {filtered ? (
              <TextAction
                label="Clear filters"
                align="center"
                onPress={() => {
                  setEmotion(null);
                  setAttach('any');
                }}
              />
            ) : null}
            <QuietButton label="Show days" tone="primary" onPress={() => setFiltering(false)} />
          </View>
        </View>
      </Modal>
    </Paper>
  );
}

const FilterChip = ({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active?: boolean;
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
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        { borderColor: active ? c.ink : c.line, backgroundColor: active ? c.accentSoft : 'transparent' },
      ]}
    >
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={t('label', { color: active ? c.ink : c.inkSoft })}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.md,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  search: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.sm,
    marginTop: space.sm,
  },
  list: { paddingTop: space.sm, paddingBottom: space.xxl },
  empty: { textAlign: 'center', marginTop: space.xxl },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    minHeight: MIN_TARGET,
  },
  weekHead: { flexDirection: 'row', marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  sheet: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg },
  sheetBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetLabel: { marginTop: space.xl, marginBottom: space.sm },
  sheetFoot: { paddingVertical: space.lg, gap: space.sm },
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
  chipDot: { width: 14, height: 14, borderRadius: 7 },
});
