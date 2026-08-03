import type { SpectrumKey } from '@/theme';
import type { DayKey } from '@/utils/date';
import type { Valence } from '@/emotions/catalog';

export type CaptureKind = 'text' | 'voice' | 'photo' | 'video' | 'link';

export type Attachment = {
  id: string;
  kind: Exclude<CaptureKind, 'text'>;
  /** Local file uri (voice/photo/video) or the URL itself for links. */
  uri: string;
  /** Seconds, for voice and video. */
  duration?: number;
  width?: number;
  height?: number;
  title?: string;
};

/** One thing you threw into your second brain. */
export type Entry = {
  id: string;
  day: DayKey;
  createdAt: string;
  kind: CaptureKind;
  text: string;
  attachments: Attachment[];
  /** Optional emotional tint, independent of the day's check-in. */
  emotion?: SpectrumKey | null;
  tags: string[];
  pinned?: boolean;
};

/** How a day felt. One per calendar day; re-checking in overwrites it. */
export type MoodLog = {
  day: DayKey;
  valence: Valence;
  /** Dominant emotion — the colour the day takes on everywhere in the app. */
  emotion: SpectrumKey;
  /** 0..1 how strongly. Drives orb size and glow. */
  intensity: number;
  /** Secondary emotions the day also carried. */
  also: SpectrumKey[];
  note?: string;
  updatedAt: string;
};

export type Profile = {
  name: string;
  avatarUri?: string | null;
  friends: number;
};

export type DiaryState = {
  entries: Entry[];
  moods: Record<DayKey, MoodLog>;
  profile: Profile;
};

export const EMPTY_STATE: DiaryState = {
  entries: [],
  moods: {},
  profile: { name: 'Riley', avatarUri: null, friends: 8 },
};
