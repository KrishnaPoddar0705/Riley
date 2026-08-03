import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
import { DateHeader, IconButton, Rule } from '@/components/Primitives';
import { useTheme } from '@/design/theme';
import { MIN_TARGET, radius, space } from '@/design/tokens';
import { EMOTIONS, EmotionKey, emotionColor } from '@/emotions/palette';
import { useDiary } from '@/store/DiaryProvider';
import { composition, isBlank } from '@/store/orb';
import {
  fromDayKey,
  monthMatrix,
  monthTitle,
  todayKey,
  WEEKDAYS_MIN,
} from '@/utils/date';

type Mode = 'timeline' | 'calendar';

/**
 * The journal. A chronological read of the diary, with the month grid folded in
 * behind a toggle rather than occupying a navigation slot of its own.
 */
export default function JournalScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { c, t } = useTheme();
  const { orbFor, noteFor, entriesFor, nameOf, loggedDays, entries } = useDiary();

  const [mode, setMode] = useState<Mode>('timeline');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EmotionKey | null>(null);
  const [searching, setSearching] = useState(false);

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  /** Days worth showing: anything with an orb, a reflection, or a saved thing. */
  const days = useMemo(() => {
    const set = new Set<string>(loggedDays);
    for (const e of entries) set.add(e.day);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [loggedDays, entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return days.filter((day) => {
      if (filter) {
        const orb = orbFor(day);
        if (isBlank(orb) || !orb!.stops.some((s) => s.emotion === filter)) return false;
      }
      if (!q) return true;
      const hay = [noteFor(day), ...entriesFor(day).map((e) => `${e.text} ${e.tags.join(' ')}`)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [days, query, filter, orbFor, noteFor, entriesFor]);

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
        <View style={styles.headActions}>
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

      {/* Colour filter. Named, not colour-only. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <FilterChip label="All" active={!filter} onPress={() => setFilter(null)} />
        {EMOTIONS.map((e) => (
          <FilterChip
            key={e.key}
            label={nameOf(e.key)}
            color={e.color}
            active={filter === e.key}
            onPress={() => setFilter((f) => (f === e.key ? null : e.key))}
          />
        ))}
      </ScrollView>

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
              {query || filter ? 'Nothing matches that.' : 'Your days will collect here.'}
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
              const d = Math.round(cell * 0.6);
              return (
                <Pressable
                  key={day}
                  onPress={() => router.push(`/day/${day}`)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    blank
                      ? `${fromDayKey(day).getDate()}, nothing recorded`
                      : `${fromDayKey(day).getDate()}, ${composition(orb!)
                          .slice(0, 2)
                          .map((p) => nameOf(p.emotion))
                          .join(' and ')}`
                  }
                  style={{ width: cell, height: cell + 14, alignItems: 'center' }}
                >
                  {blank ? (
                    // Empty days stay empty. No outlined placeholder rings.
                    <View style={{ height: d }} />
                  ) : (
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
      <Text style={t('caption', { color: active ? c.ink : c.inkSoft })}>{label}</Text>
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
  headActions: { flexDirection: 'row', alignItems: 'center' },
  search: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.sm,
    marginTop: space.sm,
  },
  filters: { gap: space.sm, paddingVertical: space.md, paddingRight: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  list: { paddingBottom: space.xxl },
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
});
