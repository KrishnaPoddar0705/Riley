import type { EmotionKey } from '@/emotions/palette';
import { composition, isBlank, Orb } from '@/store/orb';
import type { DayKey } from '@/utils/date';
import { fromDayKey } from '@/utils/date';

/**
 * Gentle observations, not diagnoses.
 *
 * Everything here is phrased as something noticed rather than something
 * measured. There are no scores, no trends to beat, and nothing appears at all
 * until there is enough of a record for a sentence to be honest.
 */

export const MIN_DAYS_FOR_INSIGHTS = 14;

type Ctx = {
  days: DayKey[];
  orbFor: (d: DayKey) => Orb | null;
  noteFor: (d: DayKey) => string;
  nameOf: (k: EmotionKey) => string;
};

const shareByDay = (ctx: Ctx) =>
  ctx.days
    .map((day) => ({ day, orb: ctx.orbFor(day) }))
    .filter((d) => !isBlank(d.orb))
    .map((d) => ({ day: d.day, parts: composition(d.orb!) }));

export const buildInsights = (ctx: Ctx): string[] => {
  const rows = shareByDay(ctx);
  if (rows.length < MIN_DAYS_FOR_INSIGHTS) return [];

  const out: string[] = [];

  // Weekend vs weekday: which feeling shows up more when nobody is asking.
  const weekendTop = new Map<EmotionKey, number>();
  const weekdayTop = new Map<EmotionKey, number>();
  for (const r of rows) {
    const dow = fromDayKey(r.day).getDay();
    const bucket = dow === 0 || dow === 6 ? weekendTop : weekdayTop;
    for (const p of r.parts) bucket.set(p.emotion, (bucket.get(p.emotion) ?? 0) + p.share);
  }
  const lead = (m: Map<EmotionKey, number>) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
  const we = lead(weekendTop);
  const wd = lead(weekdayTop);
  if (we && wd && we[0] !== wd[0]) {
    out.push(`${ctx.nameOf(we[0])} appeared more often at weekends than ${ctx.nameOf(wd[0])} did.`);
  }

  // Feelings that keep turning up together.
  const pairs = new Map<string, number>();
  for (const r of rows) {
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
    out.push(`${ctx.nameOf(a)} often arrived alongside ${ctx.nameOf(b)}.`);
  }

  // Do certain colours come with more words?
  const withWords = rows.filter((r) => ctx.noteFor(r.day).length > 40);
  if (withWords.length >= 4) {
    const tally = new Map<EmotionKey, number>();
    for (const r of withWords) for (const p of r.parts) tally.set(p.emotion, (tally.get(p.emotion) ?? 0) + p.share);
    const top = lead(tally);
    if (top) out.push(`You wrote more on days that held ${ctx.nameOf(top[0]).toLowerCase()}.`);
  }

  // Has the record warmed or cooled across the window?
  if (rows.length >= 20) {
    const half = Math.floor(rows.length / 2);
    const warmth = (slice: typeof rows) => {
      const warm: EmotionKey[] = ['joy', 'love', 'gratitude', 'hope', 'confidence'];
      let w = 0;
      let n = 0;
      for (const r of slice)
        for (const p of r.parts) {
          n += p.share;
          if (warm.includes(p.emotion)) w += p.share;
        }
      return n ? w / n : 0;
    };
    // rows are newest-first, so the tail is the earlier stretch.
    const recent = warmth(rows.slice(0, half));
    const earlier = warmth(rows.slice(half));
    if (recent - earlier > 0.12) out.push('Your recent days have run warmer than the ones before them.');
    else if (earlier - recent > 0.12) out.push('Your recent days have run cooler than the ones before them.');
  }

  return out.slice(0, 3);
};
