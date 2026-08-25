/**
 * Collision is 2D on the XZ plane: the player is a circle, obstacles are
 * axis-aligned boxes.
 *
 * ponytail: no physics engine. Walls are static, the ground is flat, and
 * nothing stacks or tumbles — a circle-vs-AABB push-out is the whole
 * requirement (PLAN §12: "do not over-engineer physics"). If a mini-game ever
 * needs real dynamics, it can own a physics engine locally without the
 * exploration layer paying for it.
 */

export type Box = {
  /** Centre on the XZ plane. */
  x: number;
  z: number;
  /** Half-extents. */
  hx: number;
  hz: number;
};

export type Point = { x: number; z: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Squared distance from a point to the nearest point on a box. */
export function distanceToBoxSq(p: Point, box: Box): number {
  const dx = Math.max(0, Math.abs(p.x - box.x) - box.hx);
  const dz = Math.max(0, Math.abs(p.z - box.z) - box.hz);
  return dx * dx + dz * dz;
}

/**
 * Push a circle out of one box along whichever axis needs the least movement,
 * which is what makes sliding along a wall feel right instead of sticking.
 */
export function resolveBox(p: Point, radius: number, box: Box): Point {
  const dx = p.x - box.x;
  const dz = p.z - box.z;

  const overlapX = box.hx + radius - Math.abs(dx);
  const overlapZ = box.hz + radius - Math.abs(dz);
  if (overlapX <= 0 || overlapZ <= 0) return p; // no contact

  if (overlapX < overlapZ) {
    // Sign of 0 is arbitrary but must be deterministic, or a player standing
    // exactly on the axis would jitter between the two faces.
    return { x: box.x + (dx < 0 ? -1 : 1) * (box.hx + radius), z: p.z };
  }
  return { x: p.x, z: box.z + (dz < 0 ? -1 : 1) * (box.hz + radius) };
}

/**
 * Resolve against every box, then clamp to the world bounds. Two passes, so
 * being pushed out of one wall into another (an inside corner) still settles.
 */
export function resolve(
  p: Point,
  radius: number,
  boxes: readonly Box[],
  bounds: number,
): Point {
  let out = p;
  for (let pass = 0; pass < 2; pass++) {
    for (const box of boxes) out = resolveBox(out, radius, box);
  }
  const limit = bounds - radius;
  return { x: clamp(out.x, -limit, limit), z: clamp(out.z, -limit, limit) };
}

/** True when the point lies inside the box, grown by `padding`. */
export function insideBox(p: Point, box: Box, padding = 0): boolean {
  return (
    Math.abs(p.x - box.x) <= box.hx + padding &&
    Math.abs(p.z - box.z) <= box.hz + padding
  );
}

/**
 * How far a third-person camera can sit behind the player before a wall gets
 * between them. Marching the segment in small steps rather than doing exact
 * ray-box intersection: the step is finer than any wall is thin, and this
 * stays readable.
 *
 * ponytail: 2D only. Every occluder here is a full-height wall or a tree
 * trunk, so ignoring the camera's height costs nothing. A low wall you should
 * be able to see over would need the real 3D test.
 */
export function clearCameraDistance(
  player: Point,
  toward: Point,
  maxDistance: number,
  boxes: readonly Box[],
  padding = 0.3,
  step = 0.2,
): number {
  const dx = toward.x - player.x;
  const dz = toward.z - player.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return maxDistance;

  const ux = dx / length;
  const uz = dz / length;

  for (let d = step; d <= maxDistance; d += step) {
    const probe = { x: player.x + ux * d, z: player.z + uz * d };
    for (const box of boxes) {
      // Stop short of the wall rather than resting against it.
      if (insideBox(probe, box, padding)) return Math.max(0, d - step);
    }
  }
  return maxDistance;
}
