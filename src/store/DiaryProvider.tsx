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
import { isBlank, Orb, orbFromLegacyMood, readOrb } from './orb';
import { buildSeed } from './seed';
import { DayNote, DiaryState, EMPTY_STATE, Entry, Settings } from './types';

const STORAGE_KEY = 'riley.diary.v1';
const SEEDED_KEY = 'riley.seeded.v1';

type DiaryContextValue = {
  ready: boolean;
  entries: Entry[];
  settings: Settings;
  orbFor: (day: DayKey) => Orb | null;
  /** Days with an orb, newest first. */
  loggedDays: DayKey[];
  /** The first day ever coloured, for range calculations. */
  firstDay: DayKey | null;
  entriesFor: (day: DayKey) => Entry[];
  noteFor: (day: DayKey) => DayNote;
  nameOf: (key: EmotionKey | string) => string;
  saveOrb: (orb: Orb) => Promise<void>;
  saveNote: (day: DayKey, patch: Partial<DayNote>) => Promise<void>;
  addEntry: (e: Omit<Entry, 'id' | 'createdAt'> & Partial<Pick<Entry, 'createdAt'>>) => Promise<Entry>;
  deleteEntry: (id: string) => Promise<void>;
  deleteDay: (day: DayKey) => Promise<void>;
  renameEmotion: (key: EmotionKey, name: string | null) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetAll: () => Promise<void>;
  clearEverything: () => Promise<void>;
};

const DiaryContext = createContext<DiaryContextValue | null>(null);

const EMPTY_NOTE: DayNote = {};

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
          const parsed = JSON.parse(raw) as Partial<DiaryState> & {
            notes?: Record<string, string>;
          };
          // Reflections used to be plain strings keyed by day.
          const days: Record<DayKey, DayNote> = { ...(parsed.days ?? {}) };
          for (const [day, text] of Object.entries(parsed.notes ?? {})) {
            if (!days[day] && text) days[day] = { text };
          }
          setState({
            ...EMPTY_STATE,
            ...parsed,
            days,
            notes: undefined,
            settings: { ...EMPTY_STATE.settings, ...(parsed.settings ?? {}) },
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
    async (day: DayKey, patch: Partial<DayNote>) => {
      commit((prev) => {
        const merged: DayNote = { ...(prev.days[day] ?? {}) };
        for (const [k, v] of Object.entries(patch)) {
          const trimmed = typeof v === 'string' ? v.trim() : v;
          if (trimmed) (merged as Record<string, unknown>)[k] = trimmed;
          else delete (merged as Record<string, unknown>)[k];
        }
        const days = { ...prev.days };
        if (Object.keys(merged).length) days[day] = merged;
        else delete days[day];
        return { ...prev, days };
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
        const days = { ...prev.days };
        delete orbs[day];
        delete moods[day];
        delete days[day];
        return { ...prev, orbs, moods, days, entries: prev.entries.filter((e) => e.day !== day) };
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

  /** Truly empty — used by onboarding so a new person starts with nothing. */
  const clearEverything = useCallback(async () => {
    const blank: DiaryState = { ...EMPTY_STATE, settings: { ...EMPTY_STATE.settings, onboarded: true } };
    setState(blank);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blank));
  }, []);

  /**
   * Orbs are normalised on read, so days written under any earlier shape —
   * one-emotion moods, or the painted-canvas model — still open correctly.
   */
  const normalised = useMemo(() => {
    const out: Record<DayKey, Orb> = {};
    for (const [day, raw] of Object.entries(state.orbs)) {
      const o = readOrb(raw, day);
      if (o) out[day] = o;
    }
    for (const [day, mood] of Object.entries(state.moods)) {
      if (!out[day]) out[day] = orbFromLegacyMood(mood);
    }
    return out;
  }, [state.orbs, state.moods]);

  const orbFor = useCallback((day: DayKey): Orb | null => normalised[day] ?? null, [normalised]);

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
      Object.keys(normalised)
        .filter((d) => !isBlank(normalised[d]))
        .sort((a, b) => (a < b ? 1 : -1)),
    [normalised]
  );

  const nameOf = useCallback(
    (key: EmotionKey | string) => state.settings.renames[key as EmotionKey] ?? emotionLabel(key),
    [state.settings.renames]
  );

  const value = useMemo<DiaryContextValue>(
    () => ({
      ready,
      entries: state.entries,
      settings: state.settings,
      orbFor,
      loggedDays,
      firstDay: loggedDays.length ? loggedDays[loggedDays.length - 1] : null,
      entriesFor: (day) => entriesByDay.get(day) ?? [],
      noteFor: (day) => state.days[day] ?? EMPTY_NOTE,
      nameOf,
      saveOrb,
      saveNote,
      addEntry,
      deleteEntry,
      deleteDay,
      renameEmotion,
      updateSettings,
      resetAll,
      clearEverything,
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
      deleteEntry,
      deleteDay,
      renameEmotion,
      updateSettings,
      resetAll,
      clearEverything,
    ]
  );

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
};

export const useDiary = () => {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used inside <DiaryProvider>');
  return ctx;
};

export { todayKey };
