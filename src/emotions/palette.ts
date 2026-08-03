/**
 * The emotional palette. Pigments, not highlighter — every colour here should
 * look like it came out of a paintbox rather than a notification badge.
 *
 * These are starting points, not a taxonomy. Users rename them freely (see
 * `renames` in the diary store) and nothing in the app treats an emotion key as
 * a diagnosis.
 */

export type EmotionKey =
  | 'joy'
  | 'calm'
  | 'gratitude'
  | 'confidence'
  | 'love'
  | 'curiosity'
  | 'longing'
  | 'anxiety'
  | 'sadness'
  | 'anger'
  | 'fatigue'
  | 'hope';

export type Emotion = {
  key: EmotionKey;
  /** The default name. The user may replace it. */
  label: string;
  /** The pigment name, used in voice-over and the long-press readout. */
  pigment: string;
  color: string;
  /** A slightly deeper version, for the shaded side of a stop. */
  deep: string;
};

export const EMOTIONS: Emotion[] = [
  { key: 'joy', label: 'Joy', pigment: 'Marigold', color: '#D9A22B', deep: '#B07F17' },
  { key: 'calm', label: 'Calm', pigment: 'Mineral blue', color: '#5C7E96', deep: '#426075' },
  { key: 'gratitude', label: 'Gratitude', pigment: 'Sage', color: '#7B9068', deep: '#5D7150' },
  { key: 'confidence', label: 'Confidence', pigment: 'Violet', color: '#6D5B93', deep: '#524475' },
  { key: 'love', label: 'Love', pigment: 'Rose', color: '#C0788A', deep: '#9E586B' },
  { key: 'curiosity', label: 'Curiosity', pigment: 'Teal', color: '#4E8C87', deep: '#376E69' },
  { key: 'longing', label: 'Longing', pigment: 'Dusty indigo', color: '#5B6285', deep: '#434A69' },
  { key: 'anxiety', label: 'Anxiety', pigment: 'Rust', color: '#B76A4E', deep: '#954F36' },
  { key: 'sadness', label: 'Sadness', pigment: 'Slate blue', color: '#6B7C95', deep: '#4F6076' },
  { key: 'anger', label: 'Anger', pigment: 'Vermilion', color: '#B4482F', deep: '#8F3420' },
  { key: 'fatigue', label: 'Fatigue', pigment: 'Soft grey', color: '#8B8880', deep: '#6C6962' },
  { key: 'hope', label: 'Hope', pigment: 'Green gold', color: '#A9B173', deep: '#88915A' },
];

export const EMOTION_BY_KEY: Record<string, Emotion> = Object.fromEntries(
  EMOTIONS.map((e) => [e.key, e])
);

export const emotionColor = (key?: string | null) =>
  (key && EMOTION_BY_KEY[key]?.color) || '#9A9389';

export const emotionDeep = (key?: string | null) =>
  (key && EMOTION_BY_KEY[key]?.deep) || '#6C6962';

/** Default name for an emotion, before any personal rename is applied. */
export const emotionLabel = (key?: string | null) =>
  (key && EMOTION_BY_KEY[key]?.label) || 'Unnamed';

export const emotionPigment = (key?: string | null) =>
  (key && EMOTION_BY_KEY[key]?.pigment) || 'Unnamed pigment';
