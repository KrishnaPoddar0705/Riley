import { emotionColor, EmotionKey, EMOTIONS } from '@/emotions/palette';
import type { DayKey } from '@/utils/date';
import { clamp, hashUnit, makeId } from '@/utils/id';
import type { MoodLog } from './types';

/**
 * A day is not one feeling, so an orb is not one colour.
 *
 * Each stop is a pigment dropped somewhere on the orb's face. Stops are painted
 * back-to-front as soft radial washes, so they bleed into one another the way
 * ink does on wet paper — never as pie slices.
 */
export type OrbStop = {
  id: string;
  emotion: EmotionKey;
  /** Where on the face, in unit-disc coordinates (-1..1, centre is 0,0). */
  x: number;
  y: number;
  /** How much of the orb this feeling took up. 0.12..1 */
  weight: number;
  /** How softly it bleeds outward. 0.25..1 */
  spread: number;
  /** Sits under the others rather than on top — "a darker centre". */
  depth?: boolean;
};

export type Orb = {
  day: DayKey;
  stops: OrbStop[];
  updatedAt: string;
};

export const MAX_STOPS = 6;

export const emptyOrb = (day: DayKey): Orb => ({ day, stops: [], updatedAt: '' });

export const isBlank = (orb?: Orb | null) => !orb || orb.stops.length === 0;

export const makeStop = (
  emotion: EmotionKey,
  x: number,
  y: number,
  overrides: Partial<OrbStop> = {}
): OrbStop => ({
  id: makeId('s'),
  emotion,
  x: clamp(x, -1, 1),
  y: clamp(y, -1, 1),
  weight: 0.55,
  spread: 0.6,
  ...overrides,
});

/**
 * Share of the orb each emotion holds, as a rounded percentage. Used for the
 * long-press readout and for screen readers — never shown as a chart.
 */
export const composition = (orb: Orb) => {
  const totals = new Map<EmotionKey, number>();
  for (const s of orb.stops) {
    // Area, not weight alone: a wide faint wash reads as more of the day than a
    // small intense dot.
    const area = s.weight * (0.4 + s.spread);
    totals.set(s.emotion, (totals.get(s.emotion) ?? 0) + area);
  }
  const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(totals.entries())
    .map(([emotion, v]) => ({ emotion, share: v / sum }))
    .sort((a, b) => b.share - a.share);
};

/** The colour a day reads as from a distance — its heaviest pigment. */
export const dominantColor = (orb?: Orb | null) => {
  if (isBlank(orb)) return null;
  const [top] = composition(orb!);
  return top ? emotionColor(top.emotion) : null;
};

export const dominantEmotion = (orb?: Orb | null): EmotionKey | null => {
  if (isBlank(orb)) return null;
  const [top] = composition(orb!);
  return top?.emotion ?? null;
};

/**
 * Carries forward days recorded under the old single-emotion check-in. The
 * primary feeling becomes a broad central wash and each secondary becomes a
 * smaller fleck, so nothing a user already wrote down is lost or flattened.
 */
export const orbFromLegacyMood = (mood: MoodLog): Orb => {
  const r = hashUnit(mood.day);
  const r2 = hashUnit(`${mood.day}:a`);
  const stops: OrbStop[] = [
    makeStop(mood.emotion as EmotionKey, (r - 0.5) * 0.5, (r2 - 0.5) * 0.5, {
      weight: clamp(mood.intensity ?? 0.6, 0.25, 1),
      spread: 0.85,
    }),
  ];
  (mood.also ?? []).forEach((key, i) => {
    const a = hashUnit(`${mood.day}:${key}:${i}`);
    const angle = a * Math.PI * 2;
    stops.push(
      makeStop(key as EmotionKey, Math.cos(angle) * 0.58, Math.sin(angle) * 0.58, {
        weight: 0.34,
        spread: 0.4,
      })
    );
  });
  return { day: mood.day, stops, updatedAt: mood.updatedAt };
};

/** A quiet, readable sentence describing an orb. Also the accessibility label. */
export const describeOrb = (orb: Orb, nameOf: (k: EmotionKey) => string) => {
  const parts = composition(orb);
  if (!parts.length) return 'An orb with no colour yet';
  if (parts.length === 1) return `Mostly ${nameOf(parts[0].emotion).toLowerCase()}`;
  const named = parts
    .slice(0, 3)
    .map((p) => `${Math.round(p.share * 100)}% ${nameOf(p.emotion).toLowerCase()}`);
  return named.join(', ');
};

/** Deterministic placement suggestion, so tapping a colour never feels random. */
export const nextPlacement = (orb: Orb, seed: string) => {
  const n = orb.stops.length;
  if (n === 0) return { x: 0, y: 0 };
  // Walk around a golden-angle spiral: reads as composed, not scattered.
  const golden = 2.399963;
  const angle = golden * n + hashUnit(seed) * 0.6;
  const r = Math.min(0.66, 0.3 + n * 0.09);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
};

export const ALL_EMOTION_KEYS = EMOTIONS.map((e) => e.key);
