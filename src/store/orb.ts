import { emotionColor, EmotionKey, EMOTIONS } from '@/emotions/palette';
import type { DayKey } from '@/utils/date';
import { clamp, hashUnit, makeId } from '@/utils/id';
import type { MoodLog } from './types';

/**
 * A day is not one feeling, so an orb is not one colour.
 *
 * There are two ways paint lands on the face. A **wash** is a soft radial
 * bloom — the broad sense of how a day felt. A **stroke** is something you drew:
 * a mark with a direction, a width and a flow. Together they behave like real
 * pigment on a wet sphere rather than a chart.
 */

/** A soft radial bloom of colour. */
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

export type BrushKind = 'brush' | 'airbrush' | 'eraser';

/** A mark drawn across the face. */
export type OrbStroke = {
  id: string;
  emotion: EmotionKey;
  kind: BrushKind;
  /** Path in unit-disc coordinates. */
  pts: { x: number; y: number }[];
  /** Half-width of the mark, in unit-disc terms. 0.06..0.42 */
  size: number;
  /** Paint strength. 0.15..1 */
  flow: number;
};

export type Orb = {
  day: DayKey;
  stops: OrbStop[];
  /** Absent on orbs saved before the canvas existed. */
  strokes?: OrbStroke[];
  updatedAt: string;
};

export const MAX_STOPS = 6;
export const MAX_STROKES = 28;
export const MAX_POINTS = 90;

/** Brush presets. Three of each, because a slider is more control than anyone needs. */
export const BRUSH_SIZES = [0.1, 0.18, 0.32] as const;
export const BRUSH_FLOWS = [0.28, 0.6, 1] as const;

export const emptyOrb = (day: DayKey): Orb => ({ day, stops: [], strokes: [], updatedAt: '' });

export const strokesOf = (orb?: Orb | null) => orb?.strokes ?? [];

export const isBlank = (orb?: Orb | null) =>
  !orb || (orb.stops.length === 0 && strokesOf(orb).length === 0);

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

export const makeStroke = (
  emotion: EmotionKey,
  kind: BrushKind,
  size: number,
  flow: number,
  first: { x: number; y: number }
): OrbStroke => ({
  id: makeId('k'),
  emotion,
  kind,
  size,
  flow,
  pts: [first],
});

/** Total ink a stroke laid down — its length, width and flow together. */
const strokeMass = (s: OrbStroke) => {
  if (s.kind === 'eraser') return 0;
  let len = 0;
  for (let i = 1; i < s.pts.length; i++) {
    len += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
  }
  // A dab still counts: give a single point the area of one brush head.
  return (len + s.size) * s.size * (s.kind === 'airbrush' ? s.flow * 0.6 : s.flow) * 2.2;
};

/**
 * Share of the orb each emotion holds. Used for the readout and for screen
 * readers — never drawn as a chart.
 */
export const composition = (orb: Orb) => {
  const totals = new Map<EmotionKey, number>();
  for (const s of orb.stops) {
    // Area, not weight alone: a wide faint wash is more of the day than a dot.
    const area = s.weight * (0.4 + s.spread);
    totals.set(s.emotion, (totals.get(s.emotion) ?? 0) + area);
  }
  for (const k of strokesOf(orb)) {
    const m = strokeMass(k);
    if (m > 0) totals.set(k.emotion, (totals.get(k.emotion) ?? 0) + m);
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
 * primary feeling becomes a broad central wash and each secondary a smaller
 * fleck, so nothing already written down is lost or flattened.
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
  return { day: mood.day, stops, strokes: [], updatedAt: mood.updatedAt };
};

/** A quiet, readable sentence describing an orb. Also the accessibility label. */
export const describeOrb = (orb: Orb, nameOf: (k: EmotionKey) => string) => {
  const parts = composition(orb);
  if (!parts.length) return 'An orb with no colour yet';
  if (parts.length === 1) return `Mostly ${nameOf(parts[0].emotion).toLowerCase()}`;
  return parts
    .slice(0, 3)
    .map((p) => `${Math.round(p.share * 100)}% ${nameOf(p.emotion).toLowerCase()}`)
    .join(', ');
};

/** Deterministic placement suggestion, so tapping a colour never feels random. */
export const nextPlacement = (orb: Orb, seed: string) => {
  const n = orb.stops.length;
  if (n === 0) return { x: 0, y: 0 };
  const golden = 2.399963;
  const angle = golden * n + hashUnit(seed) * 0.6;
  const r = Math.min(0.66, 0.3 + n * 0.09);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
};

export const ALL_EMOTION_KEYS = EMOTIONS.map((e) => e.key);
