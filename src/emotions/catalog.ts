import { spectrum, SpectrumKey } from '@/theme';

export type Valence = 'positive' | 'negative';

export type Emotion = {
  key: SpectrumKey;
  label: string;
  valence: Valence;
  color: string;
  /** A gentle second-person line shown once the emotion is picked. */
  whisper: string;
};

export const EMOTIONS: Emotion[] = [
  {
    key: 'joy',
    label: 'Joy',
    valence: 'positive',
    color: spectrum.joy,
    whisper: 'Hold onto this one a second longer.',
  },
  {
    key: 'love',
    label: 'Love',
    valence: 'positive',
    color: spectrum.love,
    whisper: 'Who made today feel warmer?',
  },
  {
    key: 'calm',
    label: 'Calm',
    valence: 'positive',
    color: spectrum.calm,
    whisper: 'Quiet days count too.',
  },
  {
    key: 'confidence',
    label: 'Confidence',
    valence: 'positive',
    color: spectrum.confidence,
    whisper: 'What did you trust yourself with?',
  },
  {
    key: 'gratitude',
    label: 'Gratitude',
    valence: 'positive',
    color: spectrum.gratitude,
    whisper: 'Name the small thing.',
  },
  {
    key: 'excitement',
    label: 'Excitement',
    valence: 'positive',
    color: spectrum.excitement,
    whisper: 'Something is coming. Say it out loud.',
  },
  {
    key: 'longing',
    label: 'Longing',
    valence: 'negative',
    color: spectrum.longing,
    whisper: 'Missing something is its own kind of loving it.',
  },
  {
    key: 'sadness',
    label: 'Sadness',
    valence: 'negative',
    color: spectrum.sadness,
    whisper: 'Sadness gets to sit here as long as it needs.',
  },
  {
    key: 'anxiety',
    label: 'Anxiety',
    valence: 'negative',
    color: spectrum.anxiety,
    whisper: 'Put the loudest thought down on paper.',
  },
  {
    key: 'anger',
    label: 'Anger',
    valence: 'negative',
    color: spectrum.anger,
    whisper: 'Anger usually knows what it wants protected.',
  },
  {
    key: 'fear',
    label: 'Fear',
    valence: 'negative',
    color: spectrum.fear,
    whisper: 'What is the smallest safe next step?',
  },
  {
    key: 'disgust',
    label: 'Disgust',
    valence: 'negative',
    color: spectrum.disgust,
    whisper: 'Something crossed a line. Which one?',
  },
  {
    key: 'tired',
    label: 'Tired',
    valence: 'negative',
    color: spectrum.tired,
    whisper: 'Rest is a valid entry.',
  },
];

export const EMOTION_BY_KEY: Record<string, Emotion> = Object.fromEntries(
  EMOTIONS.map((e) => [e.key, e])
);

export const byValence = (valence: Valence) => EMOTIONS.filter((e) => e.valence === valence);

export const emotionColor = (key?: string | null) =>
  (key && EMOTION_BY_KEY[key]?.color) || spectrum.neutral;

export const emotionLabel = (key?: string | null) =>
  (key && EMOTION_BY_KEY[key]?.label) || 'Unlogged';
