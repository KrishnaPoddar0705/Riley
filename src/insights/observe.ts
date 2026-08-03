import type { EmotionKey } from '@/emotions/palette';
import { composition, isBlank, Orb } from '@/store/orb';
import type { DayNote } from '@/store/types';
import type { DayKey } from '@/utils/date';
import { formatShort, fromDayKey, shiftDays } from '@/utils/date';

/**
 * Observations, not conclusions.
 *
 * Everything here is phrased as something noticed. No scores, no trends to
 * beat, nothing that could be mistaken for a diagnosis, and nothing at all
 * until there is enough of a record for a sentence to be honest.
 */

export const MIN_DAYS_FOR_INSIGHTS = 14;

type Ctx = {
  days: DayKey[];
  orbFor: (d: DayKey) => Orb | null;
  noteFor: (d: DayKey) => DayNote;
  nameOf: (k: EmotionKey) => string;
};

const rows = (ctx: Ctx) =>
  ctx.days
    .map((day) => ({ day, orb: ctx.orbFor(day) }))
    .filter((d) => !isBlank(d.orb))
    .map((d) => ({ day: d.day, parts: composition(d.orb!) }));

export const buildInsights = (ctx: Ctx): string[] => {
  const data = rows(ctx);
  if (data.length < MIN_DAYS_FOR_INSIGHTS) return [];

  const out: string[] = [];
  const lead = (m: Map<EmotionKey, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];

  // Weekends against the rest of the week.
  const weekend = new Map<EmotionKey, number>();
  const weekday = new Map<EmotionKey, number>();
  for (const r of data) {
    const dow = fromDayKey(r.day).getDay();
    const bucket = dow === 0 || dow === 6 ? weekend : weekday;
    for (const p of r.parts) bucket.set(p.emotion, (bucket.get(p.emotion) ?? 0) + p.share);
  }
  const we = lead(weekend);
  const wd = lead(weekday);
  if (we && wd && we[0] !== wd[0]) {
    out.push(`It looks like ${ctx.nameOf(we[0]).toLowerCase()} showed up more at weekends.`);
  }

  // Feelings that keep arriving together — the contradictions.
  const pairs = new Map<string, number>();
  for (const r of data) {
    const top = r.parts.slice(0, 3).map((p) => p.emotion);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const key = [top[i], top[j]].sort().join('|');
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  const topPair = Array.from(pairs.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topPair && topPair[1] >= 3) {
    const [a, b] = topPair[0].split('|') as EmotionKey[];
    out.push(`${ctx.nameOf(a)} often turned up alongside ${ctx.nameOf(b).toLowerCase()}.`);
  }

  // Which colours came with more words.
  const wordy = data.filter((r) => (ctx.noteFor(r.day).text ?? '').length > 40);
  if (wordy.length >= 4) {
    const tally = new Map<EmotionKey, number>();
    for (const r of wordy)
      for (const p of r.parts) tally.set(p.emotion, (tally.get(p.emotion) ?? 0) + p.share);
    const top = lead(tally);
    if (top) out.push(`You may have written more on days that held ${ctx.nameOf(top[0]).toLowerCase()}.`);
  }

  return out.slice(0, 3);
};

/* -------------------------------------------------------------------------- */

export type Memory = { day: DayKey; label: string; text: string };

/**
 * One thing worth being reminded of, or nothing.
 *
 * Prefers a real anniversary, then something kept in the same month a year
 * back, then a bright moment from the last few weeks. Returns null rather than
 * inventing something to fill the space.
 */
export const resurface = (ctx: {
  days: DayKey[];
  orbFor: (d: DayKey) => Orb | null;
  noteFor: (d: DayKey) => DayNote;
  today: DayKey;
}): Memory | null => {
  const has = new Set(ctx.days);

  const textOf = (d: DayKey) => {
    const n = ctx.noteFor(d);
    return n.bright ?? n.text ?? '';
  };

  // A year ago today.
  const lastYear = `${Number(ctx.today.slice(0, 4)) - 1}${ctx.today.slice(4)}`;
  if (has.has(lastYear) && textOf(lastYear)) {
    return { day: lastYear, label: 'From this day last year', text: textOf(lastYear) };
  }

  // The same month, a year back.
  const monthAgo = ctx.days.find(
    (d) => d.slice(0, 7) === `${Number(ctx.today.slice(0, 4)) - 1}${ctx.today.slice(4, 7)}` && textOf(d)
  );
  if (monthAgo) {
    const label = fromDayKey(monthAgo).toLocaleDateString(undefined, { month: 'long' });
    return { day: monthAgo, label: `A moment from ${label}`, text: textOf(monthAgo) };
  }

  // A bright moment from two to six weeks back — far enough to have faded.
  const from = shiftDays(ctx.today, -42);
  const to = shiftDays(ctx.today, -14);
  const bright = ctx.days.find((d) => d >= from && d <= to && ctx.noteFor(d).bright);
  if (bright) {
    return {
      day: bright,
      label: `A moment you kept · ${formatShort(bright)}`,
      text: ctx.noteFor(bright).bright!,
    };
  }

  return null;
};
