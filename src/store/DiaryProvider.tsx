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

import { EmotionKey, emotionLabel } from '@/emotions/palette';
import type { DayKey } from '@/utils/date';
import { todayKey } from '@/utils/date';
import { makeId } from '@/utils/id';
import { isBlank, Orb, orbFromLegacyMood } from './orb';
import { buildSeed } from './seed';
import { DiaryState, EMPTY_STATE, Entry, Settings } from './types';

const STORAGE_KEY = 'riley.diary.v1';
const SEEDED_KEY = 'riley.seeded.v1';

type DiaryContextValue = {
  ready: boolean;
  entries: Entry[];
  notes: Record<DayKey, string>;
  settings: Settings;
  /** The orb for a day, lifting a legacy mood record if that is all we have. */
  orbFor: (day: DayKey) => Orb | null;
  /** Days that have an orb, newest first. */
  loggedDays: DayKey[];
  todayOrb: Orb | null;
  entriesFor: (day: DayKey) => Entry[];
  noteFor: (day: DayKey) => string;
  /** The user's name for a pigment, falling back to Riley's. */
  nameOf: (key: EmotionKey | string) => string;
  saveOrb: (orb: Orb) => Promise<void>;
  saveNote: (day: DayKey, text: string) => Promise<void>;
  addEntry: (e: Omit<Entry, 'id' | 'createdAt'> & Partial<Pick<Entry, 'createdAt'>>) => Promise<Entry>;
  updateEntry: (id: string, patch: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  deleteDay: (day: DayKey) => Promise<void>;
  renameEmotion: (key: EmotionKey, name: string | null) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
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
          const parsed = JSON.parse(raw) as Partial<DiaryState>;
          setState({
            ...EMPTY_STATE,
            ...parsed,
            settings: { ...EMPTY_STATE.settings, ...(parsed.settings ?? {}) },
            // Entries used to carry an `emotion` tint; the orb owns colour now.
            entries: (parsed.entries ?? []).map((e) => ({ ...e, tags: e.tags ?? [] })),
          });
        } else if (!seeded) {
          const seed = buildSeed();
          setState(seed);
          await AsyncStorage.multiSet([
            [STORAGE_KEY, JSON.stringify(seed)],
            [SEEDED_KEY, '1'],
          ]);
        }
      } catch {
        // A corrupt store must never lock someone out of their own diary.
        setState(EMPTY_STATE);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Debounced: typing a reflection should not hit disk on every keystroke. */
  const persist = useCallback((next: DiaryState) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }, 250);
  }, []);

  const commit = useCallback(
    (updater: (prev: DiaryState) => DiaryState) => {
      setState((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const saveOrb = useCallback(
    async (orb: Orb) => {
      commit((prev) => ({
        ...prev,
        orbs: { ...prev.orbs, [orb.day]: { ...orb, updatedAt: new Date().toISOString() } },
      }));
    },
    [commit]
  );

  const saveNote = useCallback(
    async (day: DayKey, text: string) => {
      commit((prev) => {
        const notes = { ...prev.notes };
        if (text.trim()) notes[day] = text.trim();
        else delete notes[day];
        return { ...prev, notes };
      });
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

  const deleteDay = useCallback(
    async (day: DayKey) => {
      commit((prev) => {
        const orbs = { ...prev.orbs };
        const moods = { ...prev.moods };
        const notes = { ...prev.notes };
        delete orbs[day];
        delete moods[day];
        delete notes[day];
        return { ...prev, orbs, moods, notes, entries: prev.entries.filter((e) => e.day !== day) };
      });
    },
    [commit]
  );

  const renameEmotion = useCallback(
    async (key: EmotionKey, name: string | null) => {
      commit((prev) => {
        const renames = { ...prev.settings.renames };
        if (name && name.trim()) renames[key] = name.trim().slice(0, 24);
        else delete renames[key];
        return { ...prev, settings: { ...prev.settings, renames } };
      });
    },
    [commit]
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    },
    [commit]
  );

  const resetAll = useCallback(async () => {
    const fresh = buildSeed();
    setState(fresh);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  /** Legacy mood records lifted into orbs once, then memoised. */
  const migrated = useMemo(() => {
    const out: Record<DayKey, Orb> = {};
    for (const [day, mood] of Object.entries(state.moods)) {
      if (!state.orbs[day]) out[day] = orbFromLegacyMood(mood);
    }
    return out;
  }, [state.moods, state.orbs]);

  const orbFor = useCallback(
    (day: DayKey): Orb | null => state.orbs[day] ?? migrated[day] ?? null,
    [state.orbs, migrated]
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<DayKey, Entry[]>();
    for (const e of state.entries) {
      const list = map.get(e.day);
      if (list) list.push(e);
      else map.set(e.day, [e]);
    }
    return map;
  }, [state.entries]);

  const loggedDays = useMemo(
    () =>
      Array.from(new Set([...Object.keys(state.orbs), ...Object.keys(migrated)]))
        .filter((d) => !isBlank(state.orbs[d] ?? migrated[d]))
        .sort((a, b) => (a < b ? 1 : -1)),
    [state.orbs, migrated]
  );

  const nameOf = useCallback(
    (key: EmotionKey | string) =>
      state.settings.renames[key as EmotionKey] ?? emotionLabel(key),
    [state.settings.renames]
  );

  const value = useMemo<DiaryContextValue>(
    () => ({
      ready,
      entries: state.entries,
      notes: state.notes,
      settings: state.settings,
      orbFor,
      loggedDays,
      todayOrb: orbFor(todayKey()),
      entriesFor: (day) => entriesByDay.get(day) ?? [],
      noteFor: (day) => state.notes[day] ?? state.moods[day]?.note ?? '',
      nameOf,
      saveOrb,
      saveNote,
      addEntry,
      updateEntry,
      deleteEntry,
      deleteDay,
      renameEmotion,
      updateSettings,
      resetAll,
    }),
    [
      ready,
      state,
      orbFor,
      loggedDays,
      entriesByDay,
      nameOf,
      saveOrb,
      saveNote,
      addEntry,
      updateEntry,
      deleteEntry,
      deleteDay,
      renameEmotion,
      updateSettings,
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
