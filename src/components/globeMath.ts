/**
 * The globe's geometry, kept apart from its rendering so the sign conventions
 * and the layout rules can be tested rather than eyeballed.
 *
 * `project` carries the `'worklet'` directive so it can run on the UI thread.
 */

export type Projected = {
  /** Screen offset from the centre, in units of the globe radius. */
  x: number;
  y: number;
  /** 0 at the far side, 1 nearest the viewer. */
  depth: number;
  persp: number;
};

/** How much nearer points swell. Shallow; this is a held object, not a lens. */
export const PERSPECTIVE = 0.3;

/**
 * Yaw about the vertical axis, then pitch toward the viewer.
 *
 * Sign convention, which the gestures depend on:
 *   increasing `spin` moves the front-facing point to the **right**
 *   increasing `tilt` moves the front-facing point **up**
 *
 * So a rightward drag increases spin, and a downward drag decreases tilt.
 */
export const project = (
  px: number,
  py: number,
  pz: number,
  spin: number,
  tilt: number
): Projected => {
  'worklet';
  const cy = Math.cos(spin);
  const sy = Math.sin(spin);
  const x1 = px * cy + pz * sy;
  const z1 = -px * sy + pz * cy;

  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y2 = py * ct - z1 * st;
  const z2 = py * st + z1 * ct;

  const persp = 1 / (1 - z2 * PERSPECTIVE);
  return { x: x1 * persp, y: y2 * persp, depth: (z2 + 1) / 2, persp };
};

/** Eased, staggered arrival for one orb during the opening animation. */
export const assemblyProgress = (assembly: number, delay: number, window = 0.42) => {
  'worklet';
  const raw = (assembly - delay) / (1 - window);
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return 1 - Math.pow(1 - raw, 3);
};

export type Vec = { x: number; y: number; z: number };

/**
 * Days wound chronologically around a sphere, like thread on a ball.
 *
 * The oldest day starts at the bottom and the newest finishes at the top, so
 * rotation has meaning: a band of the sphere is a stretch of time, and months
 * form visible belts. This replaces the Fibonacci scatter, which distributed
 * points beautifully but told you nothing about when anything happened.
 */
export const chronologicalSpiral = (n: number, turns = 5.5): Vec[] => {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    // Oldest at the bottom, newest at the top. Negated because cos descends,
    // and the ends are biased inward so the poles do not crowd.
    const y = -Math.cos(Math.PI * (0.06 + t * 0.88));
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = t * turns * Math.PI * 2;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
};

/**
 * The first days of using the app should not look like a failed sphere. Under
 * about a fortnight the days sit on a gentle arc facing the viewer — a small
 * constellation that already feels like something.
 */
export const openingArc = (n: number): Vec[] => {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = (-0.62 + t * 1.24) * Math.PI * 0.5;
    const lift = Math.sin(t * Math.PI) * 0.22;
    pts.push({ x: Math.sin(a) * 0.82, y: -lift, z: Math.cos(a) * 0.5 });
  }
  return pts;
};

export const ARC_THRESHOLD = 14;

/** Picks the layout for a given number of days. One rule, applied everywhere. */
export const layoutFor = (n: number): Vec[] =>
  n <= ARC_THRESHOLD ? openingArc(n) : chronologicalSpiral(n);
