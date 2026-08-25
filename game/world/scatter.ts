import {
  HOUSE_BACK_OUTER,
  HOUSE_FRONT_OUTER,
  OUTER_HALF_WIDTH,
  WORLD_BOUNDS,
} from "./layout.ts";

/**
 * Deterministic pseudo-randomness. The garden must look scattered but be
 * identical every load — a composition that reshuffles on refresh can't be
 * art-directed, and `Math.random()` would also differ between server and
 * client render.
 */
export function hashRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type Placement = { x: number; z: number; rotation: number; scale: number };

/** Keep decoration off the house, off the doorstep and clear of the path. */
export function isClear(x: number, z: number, pathHalfWidth = 1.5): boolean {
  const onHouse =
    Math.abs(x) < OUTER_HALF_WIDTH + 0.6 &&
    z < HOUSE_FRONT_OUTER + 1.6 &&
    z > HOUSE_BACK_OUTER - 0.8;
  const onPath = Math.abs(x) < pathHalfWidth && z > HOUSE_FRONT_OUTER;
  return !onHouse && !onPath;
}

/**
 * Scatter `count` items across the garden, rejecting anything that would
 * land on the house or the path. Rejection rather than clever packing: the
 * loop runs once at module load.
 */
export function scatter(
  count: number,
  seed: number,
  opts: { minScale?: number; maxScale?: number; pathHalfWidth?: number } = {},
): Placement[] {
  const { minScale = 0.7, maxScale = 1.3, pathHalfWidth = 1.5 } = opts;
  const out: Placement[] = [];
  const reach = WORLD_BOUNDS - 1;

  for (let i = 0; out.length < count && i < count * 12; i++) {
    const n = seed + i * 3;
    const x = (hashRandom(n) * 2 - 1) * reach;
    const z = (hashRandom(n + 1) * 2 - 1) * reach;
    if (!isClear(x, z, pathHalfWidth)) continue;
    out.push({
      x,
      z,
      rotation: hashRandom(n + 2) * Math.PI * 2,
      scale: minScale + hashRandom(n + 3) * (maxScale - minScale),
    });
  }
  return out;
}
