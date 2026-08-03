import { EMOTIONS } from '@/emotions/catalog';
import type { SpectrumKey } from '@/theme';
import { hashUnit, makeId } from '@/utils/id';
import { lastDays, shiftDays, todayKey } from '@/utils/date';
import type { DiaryState, Entry, MoodLog } from './types';

const NOTES: Record<string, string[]> = {
  positive: [
    'Walked home the long way. The light was doing something ridiculous.',
    'Finished the thing I had been avoiding for eleven days.',
    'Called mum. Talked for an hour about nothing.',
    'Cooked properly for the first time this week.',
    'Someone said the exact thing I needed and had no idea.',
    'Sat outside with coffee and did not check my phone once.',
  ],
  negative: [
    'Too many tabs open, in the browser and otherwise.',
    'Slept badly. Everything felt one size too small today.',
    'Missed them more than usual. No particular reason.',
    'Snapped at someone who did not deserve it.',
    'Kept refreshing a page that was never going to change.',
    'Ran out of words by 3pm.',
  ],
};

const LINKS = [
  { uri: 'https://www.are.na/feed', title: 'are.na — feed' },
  { uri: 'https://ciechanow.ski/lights-and-shadows/', title: 'Lights and Shadows' },
  { uri: 'https://youtu.be/dQw4w9WgXcQ', title: 'saved for later' },
];

/**
 * First-run content so the globe has something to spin. Deterministic, so the
 * demo looks identical every time it is generated.
 */
export const buildSeed = (): DiaryState => {
  const days = lastDays(96);
  const moods: Record<string, MoodLog> = {};
  const entries: Entry[] = [];

  days.forEach((day, i) => {
    const r = hashUnit(day);
    const r2 = hashUnit(`${day}:b`);
    const r3 = hashUnit(`${day}:c`);

    // Leave a scattering of blank days so the globe reads as a real record.
    if (r > 0.82) return;

    const positiveLean = 0.62 + Math.sin(i / 11) * 0.12;
    const valence = r2 < positiveLean ? 'positive' : 'negative';
    const pool = EMOTIONS.filter((e) => e.valence === valence);
    const emotion = pool[Math.floor(r * pool.length) % pool.length].key;
    const alsoPool = pool.filter((e) => e.key !== emotion);
    const also: SpectrumKey[] =
      r3 > 0.55 ? [alsoPool[Math.floor(r3 * alsoPool.length) % alsoPool.length].key] : [];

    moods[day] = {
      day,
      valence,
      emotion,
      intensity: 0.42 + r3 * 0.55,
      also,
      note: NOTES[valence][Math.floor(r * NOTES[valence].length) % NOTES[valence].length],
      updatedAt: new Date(`${day}T21:10:00`).toISOString(),
    };

    if (r3 > 0.66) {
      entries.push({
        id: makeId('e'),
        day,
        createdAt: new Date(`${day}T09:24:00`).toISOString(),
        kind: 'text',
        text: NOTES[valence === 'positive' ? 'negative' : 'positive'][
          Math.floor(r2 * 6) % 6
        ],
        attachments: [],
        emotion,
        tags: [],
      });
    }

    if (r2 > 0.88) {
      const link = LINKS[Math.floor(r * LINKS.length) % LINKS.length];
      entries.push({
        id: makeId('e'),
        day,
        createdAt: new Date(`${day}T17:02:00`).toISOString(),
        kind: 'link',
        text: '',
        attachments: [{ id: makeId('a'), kind: 'link', uri: link.uri, title: link.title }],
        emotion: null,
        tags: ['saved'],
      });
    }
  });

  entries.push({
    id: makeId('e'),
    day: shiftDays(todayKey(), -1),
    createdAt: new Date(`${shiftDays(todayKey(), -1)}T20:40:00`).toISOString(),
    kind: 'text',
    text: 'Note to self: the version of me that starts is more useful than the version that plans.',
    attachments: [],
    emotion: 'confidence',
    tags: ['note to self'],
    pinned: true,
  });

  return {
    entries: entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    moods,
    profile: { name: 'Riley', avatarUri: null, friends: 8 },
  };
};
