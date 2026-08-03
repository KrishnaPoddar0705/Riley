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

export type Settings = {
  /** Personal names for pigments. Riley's defaults are only defaults. */
  renames: Partial<Record<EmotionKey, string>>;
  /** Quiet observations, off until asked for. */
  insights: boolean;
};

export type DiaryState = {
  entries: Entry[];
  orbs: Record<DayKey, Orb>;
  /** Read-only legacy days, migrated lazily. */
  moods: Record<DayKey, MoodLog>;
  /** One reflection per day, kept beside the orb. */
  notes: Record<DayKey, string>;
  settings: Settings;
};

export const EMPTY_STATE: DiaryState = {
  entries: [],
  orbs: {},
  moods: {},
  notes: {},
  settings: { renames: {}, insights: true },
};
