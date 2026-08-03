let counter = 0;

/** Monotonic-ish local id. Nothing leaves the device, so this is plenty. */
export const makeId = (prefix = 'id') => {
  counter = (counter + 1) % 100000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
};

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic 0..1 noise from a string — keeps generated layouts stable. */
export const hashUnit = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};
