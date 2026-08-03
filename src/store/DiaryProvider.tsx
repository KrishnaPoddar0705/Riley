import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { emotionColor } from '@/emotions/catalog';
import { spectrum } from '@/theme';
import { streakFrom, todayKey } from '@/utils/date';
import type { DayKey } from '@/utils/date';
import { makeId } from '@/utils/id';
import { buildSeed } from './seed';
import { DiaryState, EMPTY_STATE, Entry, MoodLog, Profile } from './types';

const STORAGE_KEY = 'riley.diary.v1';
const SEEDED_KEY = 'riley.seeded.v1';

type DiaryContextValue = {
  ready: boolean;
  state: DiaryState;
  /** Day -> mood, for the days that have one. */
  moods: Record<DayKey, MoodLog>;
  entries: Entry[];
  profile: Profile;
  todayMood: MoodLog | undefined;
  streak: number;
  entriesFor: (day: DayKey) => Entry[];
  colorFor: (day: DayKey) => string;
  saveMood: (mood: Omit<MoodLog, 'updatedAt'>) => Promise<void>;
  addEntry: (entry: Omit<Entry, 'id' | 'createdAt'> & Partial<Pick<Entry, 'createdAt'>>) => Promise<Entry>;
  updateEntry: (id: string, patch: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  resetAll: () => Promise<void>;
};

const DiaryContext = createContext<DiaryContextValue | null>(null);

export const DiaryProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<DiaryState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [raw, seeded] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SEEDED_KEY),
        ]);
        if (cancelled) return;
        if (raw) {
          setState({ ...EMPTY_STATE, ...(JSON.parse(raw) as DiaryState) });
        } else if (!seeded) {
          const seed = buildSeed();
          setState(seed);
          await AsyncStorage.multiSet([
            [STORAGE_KEY, JSON.stringify(seed)],
            [SEEDED_KEY, '1'],
          ]);
        }
      } catch {
        // A corrupt store should never keep someone out of their diary.
        setState(EMPTY_STATE);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Debounced persist — typing in the composer shouldn't hit disk per keystroke. */
  const persist = useCallback((next: DiaryState) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  const commit = useCallback(
    (updater: (prev: DiaryState) => DiaryState) => {
      let next: DiaryState = EMPTY_STATE;
      setState((prev) => {
        next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const saveMood = useCallback(
    async (mood: Omit<MoodLog, 'updatedAt'>) => {
      commit((prev) => ({
        ...prev,
        moods: { ...prev.moods, [mood.day]: { ...mood, updatedAt: new Date().toISOString() } },
      }));
    },
    [commit]
  );

  const addEntry = useCallback(
    async (input: Omit<Entry, 'id' | 'createdAt'> & Partial<Pick<Entry, 'createdAt'>>) => {
      const entry: Entry = {
        ...input,
        id: makeId('e'),
        createdAt: input.createdAt ?? new Date().toISOString(),
      };
      commit((prev) => ({ ...prev, entries: [entry, ...prev.entries] }));
      return entry;
    },
    [commit]
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<Entry>) => {
      commit((prev) => ({
        ...prev,
        entries: prev.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
    },
    [commit]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      commit((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
    },
    [commit]
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      commit((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
    },
    [commit]
  );

  const resetAll = useCallback(async () => {
    const fresh = buildSeed();
    setState(fresh);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  const entriesByDay = useMemo(() => {
    const map = new Map<DayKey, Entry[]>();
    for (const e of state.entries) {
      const list = map.get(e.day);
      if (list) list.push(e);
      else map.set(e.day, [e]);
    }
    return map;
  }, [state.entries]);

  const streak = useMemo(() => {
    const logged = new Set<DayKey>(Object.keys(state.moods));
    for (const e of state.entries) logged.add(e.day);
    return streakFrom(logged);
  }, [state.moods, state.entries]);

  const value = useMemo<DiaryContextValue>(
    () => ({
      ready,
      state,
      moods: state.moods,
      entries: state.entries,
      profile: state.profile,
      todayMood: state.moods[todayKey()],
      streak,
      entriesFor: (day) => entriesByDay.get(day) ?? [],
      colorFor: (day) => {
        const m = state.moods[day];
        if (m) return emotionColor(m.emotion);
        return entriesByDay.has(day) ? spectrum.neutral : 'transparent';
      },
      saveMood,
      addEntry,
      updateEntry,
      deleteEntry,
      updateProfile,
      resetAll,
    }),
    [
      ready,
      state,
      streak,
      entriesByDay,
      saveMood,
      addEntry,
      updateEntry,
      deleteEntry,
      updateProfile,
      resetAll,
    ]
  );

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
};

export const useDiary = () => {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used inside <DiaryProvider>');
  return ctx;
};
