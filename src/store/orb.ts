import { EmotionKey, emotionColor, EMOTIONS } from '@/emotions/palette';
import type { DayKey } from '@/utils/date';
import { clamp, hashUnit, makeId } from '@/utils/id';
import type { MoodLog } from './types';

/**
 * A day is rarely one feeling.
 *
 * The user says *what* they felt, *where it sat* and *how present it was*. They
 * never position, draw or blend anything — the renderer turns that description
 * into a composed object. Nobody should need to be good at drawing to describe
 * a Tuesday, and no input should be able to produce an ugly orb.
 */

/** Where a feeling lives in the day. */
export type Placement =
  /** Outwardly present — the colour of the day. */
  | 'surface'
  /** Underneath it. The private one. */
  | 'core'
  /** Lingering at the periphery, not quite gone. */
  | 'edge'
  /** A short flash that did not last. */
  | 'moment';

export const PLACEMENTS: { key: Placement; label: string; blurb: string }[] = [
  { key: 'surface', label: 'On the surface', blurb: 'Out in the open' },
  { key: 'core', label: 'Underneath', blurb: 'Beneath everything else' },
  { key: 'edge', label: 'Around the edges', blurb: 'Never quite gone' },
  { key: 'moment', label: 'A brief moment', blurb: 'It passed quickly' },
];

/** How much of the day it took. Three steps, in words, never a percentage. */
export const PRESENCE = [
  { value: 0.24, label: 'A little' },
  { value: 0.55, label: 'Some' },
  { value: 0.88, label: 'A lot' },
] as const;

export type Feeling = {
  id: string;
  emotion: EmotionKey;
  place: Placement;
  /** 0..1 */
  presence: number;
  /** Stable per-feeling variation. Two calm days never look identical. */
  seed: number;
};

export type Orb = {
  day: DayKey;
  feelings: Feeling[];
  /**
   * 1 = it settled into something coherent, 0 = it never resolved.
   * Drives haze and marbling, nothing else.
   */
  clarity: number;
  updatedAt: string;
};

export const MAX_FEELINGS = 4;

export const emptyOrb = (day: DayKey): Orb => ({
  day,
  feelings: [],
  clarity: 0.7,
  updatedAt: '',
});

export const isBlank = (orb?: Orb | null) => !orb || orb.feelings.length === 0;

export const makeFeeling = (
  emotion: EmotionKey,
  place: Placement = 'surface',
  presence: number = PRESENCE[1].value,
  seedKey = ''
): Feeling => ({
  id: makeId('f'),
  emotion,
  place,
  presence: clamp(presence, 0.15, 1),
  seed: hashUnit(`${emotion}:${place}:${seedKey}:${Math.random().toString(36).slice(2, 6)}`),
});

/** Weight a feeling carries in the overall read of the day. */
const massOf = (f: Feeling) => {
  const byPlace = { surface: 1, core: 0.72, edge: 0.5, moment: 0.28 }[f.place];
  return f.presence * byPlace;
};

/**
 * The relative share of each feeling. Used for the globe's colour, for screen
 * readers, and for the optional detail readout — never drawn as a chart.
 */
export const composition = (orb: Orb) => {
  const totals = new Map<EmotionKey, number>();
  for (const f of orb.feelings) {
    totals.set(f.emotion, (totals.get(f.emotion) ?? 0) + massOf(f));
  }
  const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(totals.entries())
    .map(([emotion, v]) => ({ emotion, share: v / sum }))
    .sort((a, b) => b.share - a.share);
};

/** The feeling a day reads as from across the room. */
export const leadFeeling = (orb?: Orb | null): Feeling | null => {
  if (isBlank(orb)) return null;
  return [...orb!.feelings].sort((a, b) => massOf(b) - massOf(a))[0] ?? null;
};

export const dominantEmotion = (orb?: Orb | null): EmotionKey | null =>
  leadFeeling(orb)?.emotion ?? null;

export const dominantColor = (orb?: Orb | null) => {
  const f = leadFeeling(orb);
  return f ? emotionColor(f.emotion) : null;
};

export const feelingsAt = (orb: Orb, place: Placement) =>
  orb.feelings.filter((f) => f.place === place);

const presenceWord = (p: number) =>
  p <= 0.35 ? 'a little' : p <= 0.7 ? 'some' : 'a lot of';

/**
 * The composition, in a sentence. This is what the product shows instead of
 * percentages — "Mostly calm, with some worry underneath."
 */
export const describeOrb = (orb: Orb, nameOf: (k: EmotionKey) => string): string => {
  if (isBlank(orb)) return 'Not coloured yet';

  const sorted = [...orb.feelings].sort((a, b) => massOf(b) - massOf(a));
  const [lead, ...rest] = sorted;
  const leadName = nameOf(lead.emotion).toLowerCase();

  let s =
    lead.presence > 0.7
      ? `Mostly ${leadName}`
      : lead.presence > 0.35
        ? `Some ${leadName}`
        : `A little ${leadName}`;

  const tail = rest.slice(0, 2).map((f) => {
    const n = nameOf(f.emotion).toLowerCase();
    const amount = presenceWord(f.presence);
    if (f.place === 'core') return `${amount} ${n} underneath`;
    if (f.place === 'edge') return `${n} around the edges`;
    if (f.place === 'moment') return `a brief ${n}`;
    return `${amount} ${n}`;
  });

  if (tail.length === 1) s += `, with ${tail[0]}`;
  else if (tail.length === 2) s += `, with ${tail[0]} and ${tail[1]}`;

  if (orb.clarity < 0.34) s += '. It never quite settled';
  return `${s}.`;
};

/** Spoken form for VoiceOver — same sentence, no trailing punctuation games. */
export const speakOrb = (orb: Orb, nameOf: (k: EmotionKey) => string) =>
  describeOrb(orb, nameOf).replace(/\.$/, '');

/* -------------------------------------------------------------------------- */
/* Migration                                                                   */
/* -------------------------------------------------------------------------- */

/** The shape orbs had while the editor was a paint canvas. */
type PaintedOrb = {
  day: DayKey;
  stops?: { emotion: string; weight?: number; spread?: number; depth?: boolean }[];
  strokes?: { emotion: string; kind?: string; size?: number; flow?: number }[];
  updatedAt?: string;
};

const isPainted = (o: unknown): o is PaintedOrb =>
  !!o && typeof o === 'object' && ('stops' in (o as object) || 'strokes' in (o as object));

/**
 * Lifts a painted orb into the described model. The heaviest wash becomes the
 * surface feeling, a sunk wash becomes the core, and anything smaller becomes
 * an edge or a moment — so a day someone already recorded keeps its character.
 */
export const orbFromPainted = (o: PaintedOrb): Orb => {
  const scored: { emotion: string; mass: number; depth: boolean }[] = [];
  for (const s of o.stops ?? []) {
    scored.push({
      emotion: s.emotion,
      mass: (s.weight ?? 0.5) * (0.4 + (s.spread ?? 0.6)),
      depth: !!s.depth,
    });
  }
  for (const k of o.strokes ?? []) {
    if (k.kind === 'eraser') continue;
    scored.push({ emotion: k.emotion, mass: (k.size ?? 0.2) * (k.flow ?? 0.6) * 2.2, depth: false });
  }

  const merged = new Map<string, { mass: number; depth: boolean }>();
  for (const s of scored) {
    const prev = merged.get(s.emotion);
    merged.set(s.emotion, {
      mass: (prev?.mass ?? 0) + s.mass,
      depth: prev?.depth || s.depth,
    });
  }

  const ranked = Array.from(merged.entries()).sort((a, b) => b[1].mass - a[1].mass);
  const feelings: Feeling[] = ranked.slice(0, MAX_FEELINGS).map(([emotion, v], i) => {
    const place: Placement = v.depth ? 'core' : i === 0 ? 'surface' : i === 1 ? 'surface' : 'moment';
    const presence = i === 0 ? 0.85 : i === 1 ? 0.5 : 0.28;
    return {
      id: makeId('f'),
      emotion: emotion as EmotionKey,
      place,
      presence,
      seed: hashUnit(`${o.day}:${emotion}`),
    };
  });

  return {
    day: o.day,
    feelings,
    clarity: feelings.length > 2 ? 0.45 : 0.72,
    updatedAt: o.updatedAt ?? '',
  };
};

/** Days recorded under the original one-emotion check-in. */
export const orbFromLegacyMood = (mood: MoodLog): Orb => {
  const feelings: Feeling[] = [
    {
      id: makeId('f'),
      emotion: mood.emotion as EmotionKey,
      place: 'surface',
      presence: clamp(mood.intensity ?? 0.6, 0.3, 1),
      seed: hashUnit(`${mood.day}:${mood.emotion}`),
    },
  ];
  (mood.also ?? []).slice(0, MAX_FEELINGS - 1).forEach((key, i) => {
    feelings.push({
      id: makeId('f'),
      emotion: key as EmotionKey,
      place: i === 0 ? 'core' : 'moment',
      presence: i === 0 ? 0.45 : 0.26,
      seed: hashUnit(`${mood.day}:${key}:${i}`),
    });
  });
  return { day: mood.day, feelings, clarity: 0.7, updatedAt: mood.updatedAt };
};

/** Normalises whatever shape is in storage into the current model. */
export const readOrb = (raw: unknown, day: DayKey): Orb | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<Orb> & PaintedOrb;
  if (Array.isArray(o.feelings)) return o as Orb;
  if (isPainted(o)) return orbFromPainted({ ...o, day });
  return null;
};

export const ALL_EMOTION_KEYS = EMOTIONS.map((e) => e.key);
