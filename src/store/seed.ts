import { EMOTIONS, EmotionKey } from '@/emotions/palette';
import { lastDays, shiftDays, todayKey } from '@/utils/date';
import { hashUnit, makeId } from '@/utils/id';
import { BRUSH_FLOWS, BRUSH_SIZES, makeStop, makeStroke, Orb, OrbStroke } from './orb';
import type { DiaryState, Entry } from './types';

/**
 * Days that read like someone's actual life rather than a demo: mixed feelings,
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

/** Feelings that genuinely turn up together. */
const PAIRS: [EmotionKey, EmotionKey][] = [
  ['calm', 'gratitude'],
  ['joy', 'love'],
  ['confidence', 'anxiety'],
  ['hope', 'longing'],
  ['fatigue', 'calm'],
  ['curiosity', 'joy'],
  ['sadness', 'love'],
  ['anger', 'anxiety'],
  ['gratitude', 'hope'],
  ['longing', 'sadness'],
];

export const buildSeed = (): DiaryState => {
  const days = lastDays(84);
  const orbs: Record<string, Orb> = {};
  const notes: Record<string, string> = {};
  const entries: Entry[] = [];

  days.forEach((day, i) => {
    const r = hashUnit(day);
    const r2 = hashUnit(`${day}:b`);
    const r3 = hashUnit(`${day}:c`);

    // Roughly one day in six goes unrecorded. Life is like that.
    if (r > 0.83) return;

    const [a, b] = PAIRS[Math.floor(r2 * PAIRS.length) % PAIRS.length];
    const stops = [
      makeStop(a, (r - 0.5) * 0.5, (r3 - 0.5) * 0.5, {
        weight: 0.5 + r2 * 0.4,
        spread: 0.7 + r * 0.25,
      }),
    ];

    if (r3 > 0.3) {
      const angle = r * Math.PI * 2;
      stops.push(
        makeStop(b, Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, {
          weight: 0.28 + r3 * 0.32,
          spread: 0.35 + r2 * 0.3,
        })
      );
    }

    // Now and then a day has a darker centre under a lighter surface.
    if (r2 > 0.78) {
      const third = EMOTIONS[Math.floor(r3 * EMOTIONS.length) % EMOTIONS.length].key;
      stops.push(makeStop(third, 0, 0, { weight: 0.42, spread: 0.34, depth: true }));
    }

    // Some days were painted rather than just washed — an arc of colour drawn
    // across the face, which is what the canvas is for.
    const strokes: OrbStroke[] = [];
    if (r2 > 0.55) {
      const a0 = r * Math.PI * 2;
      const arc = 1.1 + r3 * 1.4;
      const rad = 0.35 + r3 * 0.4;
      const pts = Array.from({ length: 5 }, (_, n) => {
        const th = a0 + (arc * n) / 4;
        return { x: Math.cos(th) * rad, y: Math.sin(th) * rad };
      });
      strokes.push({
        ...makeStroke(
          b,
          r3 > 0.72 ? 'airbrush' : 'brush',
          BRUSH_SIZES[r > 0.5 ? 1 : 0],
          BRUSH_FLOWS[r2 > 0.8 ? 2 : 1],
          pts[0]
        ),
        pts,
      });
    }

    orbs[day] = { day, stops, strokes, updatedAt: new Date(`${day}T21:10:00`).toISOString() };

    if (r3 > 0.34) {
      notes[day] = REFLECTIONS[Math.floor(r * REFLECTIONS.length) % REFLECTIONS.length];
    }

    if (r2 > 0.88) {
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
        tags: ['saved'],
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
    notes,
    settings: { renames: {}, insights: true },
  };
};
