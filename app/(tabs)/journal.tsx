import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { KIND_META } from '@/components/Capture';
import { ClayCard, Pill, PressableCard, ScriptHeading } from '@/components/Clay';
import { EntryCard } from '@/components/EntryCard';
import { Screen } from '@/components/Screen';
import { emotionColor, emotionLabel } from '@/emotions/catalog';
import { useDiary } from '@/store/DiaryProvider';
import type { CaptureKind, Entry } from '@/store/types';
import { clay, clayTight, palette, radius, space, spectrum, type } from '@/theme';
import { relativeDay } from '@/utils/date';

const FILTERS: { value: CaptureKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'text', label: 'Notes' },
  { value: 'voice', label: 'Voice' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Video' },
  { value: 'link', label: 'Links' },
];

export default function JournalScreen() {
  const router = useRouter();
  const { entries, moods, todayMood } = useDiary();
  const [filter, setFilter] = useState<CaptureKind | 'all'>('all');
  const [query, setQuery] = useState('');

  const tint = todayMood ? emotionColor(todayMood.emotion) : spectrum.confidence;

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = entries.filter((e) => {
      if (filter !== 'all' && e.kind !== filter) return false;
      if (!q) return true;
      const haystack = [
        e.text,
        ...e.tags,
        ...e.attachments.map((a) => `${a.title ?? ''} ${a.uri}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const byDay = new Map<string, Entry[]>();
    for (const e of matches) {
      const list = byDay.get(e.day);
      if (list) list.push(e);
      else byDay.set(e.day, [e]);
    }

    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, data]) => ({
        day,
        title: relativeDay(day),
        color: moods[day] ? emotionColor(moods[day].emotion) : null,
        mood: moods[day] ? emotionLabel(moods[day].emotion) : null,
        data: data.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      }));
  }, [entries, moods, filter, query]);

  return (
    <Screen tint={tint}>
      <View style={styles.head}>
        <ScriptHeading plain="Your" script="second brain" align="left" size={25} />
        <PressableCard onPress={() => router.push('/compose')} style={styles.addButton}>
          <Ionicons name="add" size={22} color={palette.ink} />
        </PressableCard>
      </View>

      <View style={styles.searchWrap}>
        <View style={[clayTight, styles.search]}>
          <Ionicons name="search" size={16} color={palette.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes, links, tags"
            placeholderTextColor={palette.inkGhost}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.filters}>
        <SectionFilters value={filter} onChange={setFilter} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <Animated.View entering={FadeIn.duration(300)} style={styles.sectionHead}>
            {section.color ? (
              <View
                style={[
                  styles.sectionDot,
                  { backgroundColor: section.color, shadowColor: section.color },
                ]}
              />
            ) : (
              <View style={[styles.sectionDot, styles.sectionDotEmpty]} />
            )}
            <Text style={[type.label, { color: palette.ink }]}>{section.title}</Text>
            {section.mood ? (
              <Text style={[type.caption, { marginLeft: 'auto' }]}>{section.mood}</Text>
            ) : null}
          </Animated.View>
        )}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index * 40, 200)).duration(340)}
            style={styles.itemWrap}
          >
            <EntryCard entry={item} onPress={() => router.push(`/entry/${item.id}`)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <ClayCard style={styles.empty}>
            <Text style={type.heading}>Nothing here yet</Text>
            <Text style={[type.body, { textAlign: 'center', marginTop: 6 }]}>
              {query
                ? 'No entry matches that search.'
                : 'Save a thought, a voice note, a photo or a link and it will land here.'}
            </Text>
            <PressableCard onPress={() => router.push('/compose')} style={styles.emptyCta}>
              <Ionicons name="add" size={16} color={palette.ink} />
              <Text style={[type.label, { color: palette.ink }]}>Add something</Text>
            </PressableCard>
          </ClayCard>
        }
      />
    </Screen>
  );
}

const SectionFilters = ({
  value,
  onChange,
}: {
  value: CaptureKind | 'all';
  onChange: (v: CaptureKind | 'all') => void;
}) => (
  <Animated.ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.md }}
  >
    {FILTERS.map((f) => (
      <Pill
        key={f.value}
        label={f.label}
        active={value === f.value}
        tint={f.value === 'all' ? undefined : KIND_META[f.value].color}
        onPress={() => onChange(f.value)}
      />
    ))}
  </Animated.ScrollView>
);

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
    ...clay,
  },
  searchWrap: { paddingHorizontal: space.md, marginTop: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
  searchInput: { flex: 1, ...type.body, fontSize: 15, color: palette.ink, paddingVertical: 0 },
  filters: { marginTop: space.sm, marginHorizontal: -space.md },
  list: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: 120 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    marginTop: space.xs,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  sectionDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.inkGhost,
  },
  itemWrap: { marginBottom: space.sm },
  empty: { alignItems: 'center', marginTop: space.xl },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.hairline,
  },
});
