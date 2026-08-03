/** All dates in Riley are keyed by local calendar day: `YYYY-MM-DD`. */
export type DayKey = string;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const toDayKey = (d: Date = new Date()): DayKey =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromDayKey = (key: DayKey): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const todayKey = () => toDayKey();

export const shiftDays = (key: DayKey, delta: number): DayKey => {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
};

/** Inclusive list of day keys ending at `end`, `count` long, oldest first. */
export const lastDays = (count: number, end: DayKey = todayKey()): DayKey[] => {
  const out: DayKey[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftDays(end, -i));
  return out;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS_MIN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const formatLong = (key: DayKey) => {
  const d = fromDayKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatShort = (key: DayKey) => {
  const d = fromDayKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

export const monthTitle = (year: number, month: number) => `${MONTHS[month]} ${year}`;

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
};

export const relativeDay = (key: DayKey) => {
  if (key === todayKey()) return 'Today';
  if (key === shiftDays(todayKey(), -1)) return 'Yesterday';
  return formatLong(key);
};

export const greeting = (d: Date = new Date()) => {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Winding down';
};

/** Monday-first grid for a month, padded with nulls to whole weeks. */
export const monthMatrix = (year: number, month: number): (DayKey | null)[] => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // shift Sunday=0 to Monday=0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (DayKey | null)[] = Array(lead).fill(null);
  for (let i = 1; i <= days; i++) cells.push(toDayKey(new Date(year, month, i)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

/**
 * Longest run of consecutive logged days ending today (or yesterday, so the
 * streak doesn't look broken before you've checked in this morning).
 */
export const streakFrom = (loggedKeys: Set<DayKey>): number => {
  let cursor = todayKey();
  if (!loggedKeys.has(cursor)) {
    cursor = shiftDays(cursor, -1);
    if (!loggedKeys.has(cursor)) return 0;
  }
  let n = 0;
  while (loggedKeys.has(cursor)) {
    n++;
    cursor = shiftDays(cursor, -1);
  }
  return n;
};
