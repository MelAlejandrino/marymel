/**
 * The cabinet's shape, and the claw's.
 *
 * This is the base module: `mechanics.ts` reads its dimensions from here, not
 * the other way round. That matters because the claw's stopping height is
 * *derived from how long the prongs are* — the previous arrangement had it the
 * wrong way round, which forced the prongs to be stubby enough to stop
 * clipping the floor, and they stopped looking like a claw.
 *
 * A claw whose fingers sink through the floor, or a chute hole that is not
 * under the chute, is not something anyone can spot by reading numbers.
 * `geometry.test.ts` checks them.
 */

/** Half-extents of the play area, on the floor. */
export const BOUNDS = { x: 0.4, z: 0.3 } as const;

/** Vertical geometry, measured from the base of the cabinet. */
export const PLAY = {
  /** Surface the capsules rest on. */
  floorY: 0.62,
  /** Where the claw parks between goes. */
  parkY: 1.52,
  capsuleR: 0.055,
  /** Where a released capsule comes to rest, down the chute. */
  chuteFloorY: 0.17,
} as const;

/** The hole in the floor, in the corner the chute sits in. */
export const CHUTE = { x: -0.36, z: 0.26 } as const;

export const CASE = {
  width: (BOUNDS.x + 0.1) * 2,
  depth: (BOUNDS.z + 0.1) * 2,
} as const;

export const RAIL_Y = PLAY.parkY + 0.07;
export const GLASS_TOP = PLAY.parkY + 0.24;

export const HOLE = {
  minX: -CASE.width / 2,
  maxX: -0.22,
  minZ: 0.12,
  maxZ: CASE.depth / 2,
} as const;

/** How far the cabinet's skin stands outside the glass. */
export const SKIN = 0.04;

/**
 * The shaft the prize falls down, carved out of the base cabinet.
 *
 * The base used to be one solid box, so a capsule falling to `chuteFloorY`
 * landed *inside* it and simply vanished. The base is now built from blocks
 * around this void, with a transparent panel on its front face so the landing
 * is something you can watch.
 *
 * Its footprint matches HOLE, so the hole in the play floor opens straight
 * into it.
 */
export const CHUTE_VOID = {
  minX: -CASE.width / 2 - SKIN,
  maxX: HOLE.maxX,
  minZ: HOLE.minZ,
  maxZ: CASE.depth / 2 + SKIN,
  /** Surface the prize comes to rest on. */
  trayTopY: PLAY.chuteFloorY - PLAY.capsuleR,
  /** The void opens into the play floor at the top. */
  topY: PLAY.floorY,
} as const;

/** Whether a point is inside the shaft, so a falling prize is visible. */
export function inChuteVoid(x: number, y: number, z: number): boolean {
  return (
    x >= CHUTE_VOID.minX &&
    x <= CHUTE_VOID.maxX &&
    z >= CHUTE_VOID.minZ &&
    z <= CHUTE_VOID.maxZ &&
    y >= CHUTE_VOID.trayTopY &&
    y <= CHUTE_VOID.topY
  );
}

/** Small, so the fingers are the thing you notice. */
export const HUB = { radiusTop: 0.05, radiusBottom: 0.062, height: 0.052 } as const;

/**
 * One finger: a tapered upper bone hanging from the hinge, and a toe that curls
 * inward at a knuckle. Two bones and a curl is what reads as a claw — a single
 * straight box reads as a robot, and boxes at all read as a machine part.
 *
 * `splay` is a POSITIVE outward angle. The transform negates it, because a
 * positive rotation about X swings a hanging finger *inward* — getting that
 * backwards had all three fingers collapsed through the middle when open and
 * standing straight when shut.
 */
export const PRONG = {
  hinge: { y: -0.012, z: 0.026 },
  upper: { length: 0.17, rTop: 0.019, rBottom: 0.014 },
  toe: { length: 0.1, rTop: 0.014, rBottom: 0.007, curl: 1.25 },
  /** Spread wide at rest, converging underneath when gripping. */
  splayOpen: 0.62,
  splayShut: 0.1,
} as const;

/** Rotate a point about the X axis. */
function rotX(y: number, z: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { y: y * c - z * s, z: y * s + z * c };
}

type Sample = { y: number; z: number; r: number };

/**
 * Points along one finger, in the hub's frame, each with the thickness there.
 * Sampled rather than solved: the shape is two tapered bones and a curl, and a
 * dozen samples answers every question worth asking about it.
 */
export function prongSamples(splay: number): Sample[] {
  const out: Sample[] = [];
  const place = (y: number, z: number, r: number) => {
    const p = rotX(y, z, -splay);
    out.push({ y: PRONG.hinge.y + p.y, z: PRONG.hinge.z + p.z, r });
  };

  const { upper, toe } = PRONG;
  for (let t = 0; t <= 1.0001; t += 0.2) {
    place(-upper.length * t, 0, upper.rTop + (upper.rBottom - upper.rTop) * t);
  }
  // The toe hinges at the end of the upper bone.
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const o = rotX(-toe.length * t, 0, toe.curl);
    place(-upper.length + o.y, o.z, toe.rTop + (toe.rBottom - toe.rTop) * t);
  }

  return out;
}

/** How far below the hub the finger reaches at a given splay. */
export const prongDrop = (splay: number) =>
  -Math.min(...prongSamples(splay).map((p) => p.y - p.r));

/** How wide the claw is across, at a given splay. */
export const clawWidth = (splay: number) =>
  2 * Math.max(...prongSamples(splay).map((p) => p.z + p.r));

/** How far out the fingertips are. Negative means they have met underneath. */
export const fingertipRadius = (splay: number) => {
  const samples = prongSamples(splay);
  return samples[samples.length - 1].z;
};

/**
 * The deepest the fingers ever reach, across the whole closing sweep. A finger
 * swinging toward vertical reaches lower than a splayed one, so the extreme is
 * somewhere in the middle rather than at either end.
 */
export const PRONG_REACH = (() => {
  let deepest = 0;
  for (let i = 0; i <= 60; i++) {
    const splay = PRONG.splayShut + (PRONG.splayOpen - PRONG.splayShut) * (i / 60);
    deepest = Math.max(deepest, prongDrop(splay));
  }
  return deepest;
})();

/**
 * Where the claw stops on the way down: low enough that the fingertips graze
 * the floor, which is how far a real claw descends.
 */
export const GRAB_Y = PLAY.floorY + PRONG_REACH;

/**
 * How far below the hub a held capsule hangs.
 *
 * Derived, not chosen: a resting capsule's centre is at `floorY + r`, and the
 * hub stops at `GRAB_Y`, so this is the gap between them. Any other value makes
 * the capsule jump the instant it is grabbed.
 */
export const HANG = GRAB_Y - (PLAY.floorY + PLAY.capsuleR);

/** The lowest point of the claw, for a hub at `clawY`. */
export const clawLowestY = (clawY: number, splay: number) => clawY - prongDrop(splay);

/** Where a held capsule's centre sits, given the hub height. */
export const heldCapsuleY = (clawY: number) => clawY - HANG;

/** Whether a point on the floor is over the hole. */
export function overHole(x: number, z: number): boolean {
  return x >= HOLE.minX && x <= HOLE.maxX && z >= HOLE.minZ && z <= HOLE.maxZ;
}
