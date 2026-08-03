/**
 * The globe's geometry, kept apart from its rendering so the sign conventions
 * can be tested rather than eyeballed — getting a rotation backwards is not
 * something you notice by reading the code.
 *
 * `project` carries the `'worklet'` directive so it can be called from the UI
 * thread by both the node transforms and the thread path.
 */

export type Projected = {
  /** Screen offset from the centre, in units of the globe radius. */
  x: number;
  y: number;
  /** 0 at the far side, 1 nearest the viewer. */
  depth: number;
  /** Perspective scale for this point. */
  persp: number;
};

/** How much nearer points swell. Kept shallow; this is a held object, not a lens. */
export const PERSPECTIVE = 0.3;

/**
 * Yaw about the vertical axis, then pitch toward the viewer.
 *
 * Sign convention, which the gestures depend on:
 *   increasing `spin` moves the front-facing point to the **right**
 *   increasing `tilt` moves the front-facing point **up**
 *
 * So a rightward drag must increase spin, and a downward drag must decrease
 * tilt. Get either backwards and the globe fights the finger.
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
 * Nearest-neighbour lattice. Connecting spatial neighbours rather than
 * consecutive days keeps every thread short and hugging the surface, which is
 * what makes the cluster read as strung marbles instead of loose bubbles.
 */
export const buildLinks = (points: Vec[], perNode = 2): [number, number][] => {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < points.length; i++) {
    const scored: { j: number; d: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dz = points[i].z - points[j].z;
      scored.push({ j, d: dx * dx + dy * dy + dz * dz });
    }
    scored.sort((a, b) => a.d - b.d);
    for (const { j } of scored.slice(0, perNode)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([i, j]);
    }
  }
  return pairs;
};

/** Evenly spaced points on a sphere — no clumping at the poles. */
export const fibonacciSphere = (n: number): Vec[] => {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
};
