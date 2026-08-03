import { EmotionKey } from '@/emotions/palette';
import { lastDays, shiftDays, todayKey } from '@/utils/date';
import { hashUnit, makeId } from '@/utils/id';
import { Feeling, Orb, Placement } from './orb';
import type { DayNote, DiaryState, Entry } from './types';

/**
 * Days that read like somebody's actual life: mixed feelings, contradictions,
 * gaps where nothing was written, and only occasional media.
 */
const REFLECTIONS = [
  'Walked home the long way. The light was doing something ridiculous.',
  'Finished the thing I had been circling for eleven days.',
  'Called mum. Talked for an hour about nothing much.',
  'Slept badly. Everything sat one size too small.',
  'Ran out of words by three in the afternoon.',
  'Someone said the exact right thing and had no idea.',
  'Sat outside with coffee and did not touch my phone.',
  'Missed them more than usual. No particular reason.',
  'Said yes to something before I could talk myself out of it.',
  'Quiet day. Nothing to report, which is its own kind of report.',
];

const BRIGHT = [
  'The first coffee, before anyone needed anything.',
  'A dog on the train, entirely delighted to be there.',
  'Someone held a door and meant it.',
  'Ten minutes of sun on the back step.',
];

const DIFFICULT = [
  'The conversation I keep not having.',
  'Too many open loops and no way to close any of them.',
  'Tired in a way sleep does not fix.',
];

/** Combinations that genuinely occur — the surface and what sits under it. */
const SHAPES: { lead: EmotionKey; under: EmotionKey; place: Placement }[] = [
  { lead: 'joy', under: 'fatigue', place: 'core' },
  { lead: 'confidence', under: 'anxiety', place: 'core' },
  { lead: 'calm', under: 'sadness', place: 'core' },
  { lead: 'gratitude', under: 'longing', place: 'edge' },
  { lead: 'hope', under: 'anxiety', place: 'edge' },
  { lead: 'fatigue', under: 'joy', place: 'moment' },
  { lead: 'sadness', under: 'love', place: 'core' },
  { lead: 'curiosity', under: 'joy', place: 'moment' },
  { lead: 'love', under: 'longing', place: 'core' },
  { lead: 'anxiety', under: 'hope', place: 'moment' },
];

export const buildSeed = (): DiaryState => {
  const days = lastDays(84);
  const orbs: Record<string, Orb> = {};
  const dayNotes: Record<string, DayNote> = {};
  const entries: Entry[] = [];

  days.forEach((day) => {
    const r = hashUnit(day);
    const r2 = hashUnit(`${day}:b`);
    const r3 = hashUnit(`${day}:c`);

    // Roughly one day in six goes unrecorded. Life is like that.
    if (r > 0.83) return;

    const shape = SHAPES[Math.floor(r2 * SHAPES.length) % SHAPES.length];

    const feelings: Feeling[] = [
      {
        id: makeId('f'),
        emotion: shape.lead,
        place: 'surface',
        presence: 0.55 + r * 0.4,
        seed: hashUnit(`${day}:lead`),
      },
      {
        id: makeId('f'),
        emotion: shape.under,
        place: shape.place,
        presence: 0.24 + r3 * 0.45,
        seed: hashUnit(`${day}:under`),
      },
    ];

    // Now and then a third thing flickers through.
    if (r3 > 0.72) {
      feelings.push({
        id: makeId('f'),
        emotion: SHAPES[Math.floor(r * SHAPES.length) % SHAPES.length].lead,
        place: 'moment',
        presence: 0.26,
        seed: hashUnit(`${day}:flick`),
      });
    }

    orbs[day] = {
      day,
      feelings,
      // Some days simply do not resolve.
      clarity: r2 > 0.76 ? 0.22 : 0.62 + r * 0.3,
      updatedAt: new Date(`${day}T21:10:00`).toISOString(),
    };

    const note: DayNote = {};
    if (r3 > 0.34) note.text = REFLECTIONS[Math.floor(r * REFLECTIONS.length) % REFLECTIONS.length];
    if (r2 > 0.7) note.bright = BRIGHT[Math.floor(r3 * BRIGHT.length) % BRIGHT.length];
    if (r > 0.68) note.difficult = DIFFICULT[Math.floor(r2 * DIFFICULT.length) % DIFFICULT.length];
    if (Object.keys(note).length) dayNotes[day] = note;

    if (r2 > 0.9) {
      entries.push({
        id: makeId('e'),
        day,
        createdAt: new Date(`${day}T17:02:00`).toISOString(),
        kind: 'link',
        text: '',
        attachments: [
          {
            id: makeId('a'),
            kind: 'link',
            uri: 'https://ciechanow.ski/lights-and-shadows/',
            title: 'Lights and Shadows',
          },
        ],
        tags: [],
      });
    }
  });

  const yesterday = shiftDays(todayKey(), -1);
  entries.push({
    id: makeId('e'),
    day: yesterday,
    createdAt: new Date(`${yesterday}T20:40:00`).toISOString(),
    kind: 'text',
    text: 'The version of me that starts is more useful than the version that plans.',
    attachments: [],
    tags: [],
    pinned: true,
  });

  return {
    entries: entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    orbs,
    moods: {},
    days: dayNotes,
    settings: { renames: {}, insights: true, onboarded: true },
  };
};
