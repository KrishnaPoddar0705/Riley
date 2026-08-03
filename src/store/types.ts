import type { EmotionKey } from '@/emotions/palette';
import type { DayKey } from '@/utils/date';
import type { Orb } from './orb';

export type CaptureKind = 'text' | 'voice' | 'photo' | 'video' | 'link';

export type Attachment = {
  id: string;
  kind: Exclude<CaptureKind, 'text'>;
  /** Local file uri, or the URL itself for links. */
  uri: string;
  duration?: number;
  width?: number;
  height?: number;
  title?: string;
};

/** Something kept from a day: a few words, a voice note, a photo, a link. */
export type Entry = {
  id: string;
  day: DayKey;
  createdAt: string;
  kind: CaptureKind;
  text: string;
  attachments: Attachment[];
  tags: string[];
  pinned?: boolean;
};

/**
 * The old one-feeling-per-day record. Nothing writes this any more, but plenty
 * of people have days stored in this shape, so it stays readable forever and is
 * lifted into an Orb on the way out of the store.
 */
export type MoodLog = {
  day: DayKey;
  valence: 'positive' | 'negative';
  emotion: EmotionKey | string;
  intensity: number;
  also: (EmotionKey | string)[];
  note?: string;
  updatedAt: string;
};

/** Everything written about a day, beside its orb. */
export type DayNote = {
  /** Optional user title for the day. */
  title?: string;
  /** The main reflection. */
  text?: string;
  /** "A quiet light" — something good, however small. */
  bright?: string;
  /** "What weighed on me" — something hard. */
  difficult?: string;
};

export type Settings = {
  /** Personal names for pigments. Riley's defaults are only defaults. */
  renames: Partial<Record<EmotionKey, string>>;
  /** Quiet observations, off until asked for. */
  insights: boolean;
  /** Set once the three opening screens have been seen. */
  onboarded?: boolean;
};

export type DiaryState = {
  entries: Entry[];
  orbs: Record<DayKey, Orb>;
  /** Read-only legacy days, migrated lazily. */
  moods: Record<DayKey, MoodLog>;
  /** What was written about each day, beside its orb. */
  days: Record<DayKey, DayNote>;
  /** Pre-`days` storage. Read on load, never written. */
  notes?: Record<DayKey, string>;
  settings: Settings;
};

export const EMPTY_STATE: DiaryState = {
  entries: [],
  orbs: {},
  moods: {},
  days: {},
  settings: { renames: {}, insights: true, onboarded: false },
};
