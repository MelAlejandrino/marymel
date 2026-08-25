/**
 * The avatar's proportions, in one place.
 *
 * Faces are unforgiving: an eye a centimetre too far out floats off the head,
 * a hair shell a few degrees too long swallows it. These numbers are checked
 * in `rig.test.ts` rather than eyeballed.
 *
 * Coordinates in FACE and HAIR are relative to the centre of the head.
 */

export const RIG = {
  hipY: 0.5,
  shoulderY: 0.9,
  headY: 1.24,
  headR: 0.25,
  legLength: 0.4,
  legRadius: 0.07,
  armLength: 0.3,
  armRadius: 0.055,
  /** Shoulder offset from the centre line. */
  armX: 0.215,
  /** Arms angled out, so the forearm clears the flare of the dress. */
  armOut: 0.16,
  legX: 0.1,
  shoe: { drop: 0.045, width: 0.15, height: 0.09, depth: 0.22, forward: 0.03 },
  dress: { bottomY: 0.45, topY: 0.99, rTop: 0.16, rBottom: 0.27 },
} as const;

export const FACE = {
  eye: { x: 0.088, y: 0.035, z: 0.215, r: 0.038 },
  /** Offset from the centre of the eye, not from the head — it sits on the
   *  eye, which itself stands proud of the face. */
  catchlight: { dx: -0.01, dy: 0.014, dz: 0.028, r: 0.013 },
  blush: { x: 0.143, y: -0.042, z: 0.162, r: 0.045 },
  /** Half-torus, opened upward into a smile. */
  mouth: { y: -0.075, z: 0.225, r: 0.04, tube: 0.011 },
} as const;

export const HAIR = {
  /** Crown cap: must stop above the brow. */
  crown: { lift: 0.022, thetaLength: Math.PI * 0.4 },
  /** Back shell: must not wrap round onto the face. */
  back: {
    lift: 0.02,
    phiStart: Math.PI * 0.88,
    phiLength: Math.PI * 1.24,
    thetaLength: Math.PI * 0.82,
  },
  /** Locks framing the face, below the crown and clear of the back shell. */
  sideLock: { x: 0.17, y: 0.02, z: 0.12, r: 0.08 },
  ponytail: { y: 0.08, z: -0.23 },
} as const;

export type Point3 = { x: number; y: number; z: number };

export const distance = (p: Point3) => Math.hypot(p.x, p.y, p.z);

/** Angle down from the crown, in radians — three's `theta` for a sphere. */
export function polarAngle(p: Point3): number {
  const d = distance(p);
  return d === 0 ? 0 : Math.acos(p.y / d);
}

/**
 * Angle around the vertical axis, in three's sphere convention, normalised to
 * [0, 2pi). SphereGeometry places a vertex at
 * `x = -r cos(phi) sin(theta)`, `z = r sin(phi) sin(theta)`, which puts
 * `phi = 0` at -X and the face, at +Z, at `phi = pi/2`.
 */
export function azimuth(p: Point3): number {
  const a = Math.atan2(p.z, -p.x);
  return a < 0 ? a + Math.PI * 2 : a;
}

/** True when `phi` falls inside a partial sphere's sweep, wrapping included. */
export function sweepCovers(
  phi: number,
  phiStart: number,
  phiLength: number,
): boolean {
  const rel = (((phi - phiStart) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return rel <= phiLength;
}

/** Radius of the flared dress at a given height. */
export function dressRadiusAt(y: number): number {
  const { bottomY, topY, rTop, rBottom } = RIG.dress;
  const t = Math.min(1, Math.max(0, (y - bottomY) / (topY - bottomY)));
  return rBottom + (rTop - rBottom) * t;
}

/** Where a hand ends up, given the outward angle of the arm. */
export function handPosition(): { x: number; y: number } {
  return {
    x: RIG.armX + Math.sin(RIG.armOut) * RIG.armLength,
    y: RIG.shoulderY - Math.cos(RIG.armOut) * RIG.armLength,
  };
}

/** Height of the bottom of the shoe when the leg hangs straight. */
export function shoeBottomY(): number {
  return RIG.hipY - RIG.legLength - RIG.shoe.drop - RIG.shoe.height / 2;
}
