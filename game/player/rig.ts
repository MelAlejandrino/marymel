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
  /**
   * How far down the leg the knee sits. The leg is two segments, not one
   * capsule: a straight leg cannot sit down. Rotating a single capsule forward
   * to sit puts the feet in the air at hip height, which reads as sitting on
   * the floor rather than on a chair.
   */
  kneeAt: 0.21,
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
  /** Hands, so the arms end in something instead of stopping. */
  hand: { r: 0.062 },
  /** Puff sleeve capping each shoulder. */
  sleeve: { r: 0.105, squash: 0.8 },
  /** Sash tied at the waist, with the bow at the back. */
  sash: { y: 0.84, height: 0.075, bow: { r: 0.058, tail: 0.11 } },
  /** Underskirt peeking out below the hem — one extra ring of colour is most
   *  of what separates "a dress" from "a cone". */
  petticoat: { drop: 0.055, flare: 0.028, height: 0.07 },
} as const;

export const FACE = {
  eye: { x: 0.088, y: 0.035, z: 0.215, r: 0.038 },
  /** Offset from the centre of the eye, not from the head — it sits on the
   *  eye, which itself stands proud of the face. */
  catchlight: { dx: -0.01, dy: 0.014, dz: 0.028, r: 0.013 },
  blush: { x: 0.143, y: -0.042, z: 0.162, r: 0.045 },
  /** Half-torus, opened upward into a smile. */
  mouth: { y: -0.075, z: 0.225, r: 0.04, tube: 0.011 },
  /** Brows sit above the eyes but below the crown cap, or the hair eats them. */
  brow: { x: 0.088, y: 0.089, z: 0.211, w: 0.078, h: 0.019, d: 0.04, tilt: 0.16 },
  /** Lashes ride on the eye, like the catchlight — offsets from its centre. */
  lash: { dx: 0.012, dy: 0.032, dz: 0.006, w: 0.062, h: 0.016, d: 0.03, tilt: 0.35 },
  /** Tiny on purpose: a chibi nose is a hint, not a feature. */
  nose: { y: -0.012, z: 0.245, r: 0.022 },
} as const;

export const HAIR = {
  /** Crown cap: must stop above the brow — which is now drawn, so this got
   *  shorter to leave the brow line showing. */
  crown: { lift: 0.022, thetaLength: Math.PI * 0.36 },
  /** Back shell: must not wrap round onto the face. */
  back: {
    lift: 0.02,
    phiStart: Math.PI * 0.88,
    phiLength: Math.PI * 1.24,
    thetaLength: Math.PI * 0.82,
  },
  /** Locks framing the face, below the crown and clear of the back shell. */
  sideLock: { x: 0.17, y: 0.02, z: 0.12, r: 0.08 },
  /** A flower tucked in over one ear, sitting on the crown. */
  flower: { x: -0.176, y: 0.182, z: 0.079, r: 0.036, petals: 5 },
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

/**
 * The seated and lying poses, as joint angles in radians. Kept here with the
 * rest of the proportions rather than buried in the render loop, so
 * `rig.test.ts` can check the feet end up on the floor and not through it.
 */
export const POSTURE = {
  sit: {
    /** Thigh swung up toward horizontal. */
    thigh: -1.42,
    /**
     * Shin down from the knee — but not straight down. Her thigh is only 0.21
     * long, so her knees barely pass the front edge of a seat; angling the
     * shins forward is what actually puts her lower legs and feet out in front
     * of the furniture instead of inside it.
     */
    shin: 1.05,
    /** Leaned back into the seat. */
    lean: -0.12,
    /** Hands come to rest in her lap. */
    arm: 0.42,
    armOut: 0.05,
    /**
     * The skirt has to get out of the way, or sitting is invisible: it is a
     * rigid cone hanging from the waist, and the whole folded-up leg fits
     * inside it. Tilted forward from the waist and taken up a little, it
     * drapes back over the seat and the knees come out in front of it.
     */
    skirtTilt: -0.35,
    skirtTakeUp: 0.95,
  },
  lie: {
    thigh: 0.06,
    shin: 0.04,
    lean: 0,
    arm: -0.12,
    armOut: 0.22,
    // Lying down, the skirt falls along her and needs no help.
    skirtTilt: 0,
    skirtTakeUp: 1,
  },
  /**
   * Crouched down to pet an animal. Not a seat: she keeps her feet, so this
   * one is a layer over whatever else she is doing rather than a posture, and
   * `crouchDrop()` below brings her hips down with her folded legs.
   *
   * The shin cancels the thigh (they sum to zero), which keeps her soles flat
   * on the grass — a crouch with the feet pitched nose-down reads as tiptoe.
   */
  pat: {
    thigh: -1.128,
    shin: 1.128,
    /** Leaning in over the animal. */
    lean: 0.28,
    /** The stroking arm: down and forward. Negative is forward. */
    arm: -0.95,
    /**
     * ...and out to her right, which is the whole reason the animal is petted
     * beside her instead of in front of her. Reaching *inward* put her hand on
     * her own centre line, and the animal that came to meet it ended up under
     * her skirt.
     */
    armOut: 0.62,
    /** How far the stroke sweeps, either side of `arm`. */
    stroke: 0.2,
    /** The other hand rests on her knee. */
    restArm: -0.5,
    restArmOut: 0.3,
    /**
     * The skirt barely moves. A big forward tilt swings the hem out over
     * exactly the ground the animal is standing on — and the hem is a rigid
     * cone, so whatever it reaches over, it covers.
     */
    skirtTilt: -0.05,
    skirtTakeUp: 0.95,
    /** Looking down at what she is petting. */
    headPitch: 0.34,
  },
} as const;

/**
 * How far her hips drop in the crouch.
 *
 * Derived, not eyeballed: her legs fold at the hip and the knee, and the whole
 * body has to come down by however much shorter that makes them, or she
 * crouches with her feet hanging in the air.
 */
export function crouchDrop(): number {
  const standing = footFromHip(0, 0).drop;
  return standing - footFromHip(POSTURE.pat.thigh, POSTURE.pat.shin).drop;
}

/**
 * Where her patting hand actually ends up, in her own space, at `stroke` along
 * the sweep (-1..1).
 *
 * This is the contract between her and the animal: `world/critters.ts` sizes
 * the rabbit against this number and puts it where the hand will be, and
 * `critters.test.ts` fails if the two ever stop meeting. Reaching for a rabbit
 * and missing it by five centimetres is the whole difference between petting
 * an animal and miming.
 */
export function patHand(stroke = 0): Point3 {
  const { arm, armOut, stroke: sweep, lean } = POSTURE.pat;
  const forward = arm + stroke * sweep;
  // Euler XYZ: the z rotation swings the arm out (or in) first, so the reach
  // the x rotation then swings forward is shortened by cos(armOut).
  const reach = RIG.armLength * Math.cos(armOut);
  const local = {
    x: RIG.armX + RIG.armLength * Math.sin(armOut),
    y: RIG.shoulderY - reach * Math.cos(forward),
    z: -reach * Math.sin(forward),
  };
  // Then the whole torso leans in over the animal and the hips drop.
  return {
    x: local.x,
    y: local.y * Math.cos(lean) - local.z * Math.sin(lean) - crouchDrop(),
    z: local.y * Math.sin(lean) + local.z * Math.cos(lean),
  };
}

/** The underside of her palm — what has to land on the animal's head. */
export function patHandBottom(stroke = 0): number {
  return patHand(stroke).y - RIG.hand.r;
}

/** How far she turns her head to look at what she is petting: it is beside
 *  her, not in front of her, so she has to actually look at it. Clamped to the
 *  same limit as every other glance — a head that turns past the shoulders is
 *  the difference between charming and unsettling. */
export function patLook(limit = 0.7): number {
  const hand = patHand();
  return Math.min(limit, Math.max(-limit, Math.atan2(hand.x, hand.z)));
}

/** How far forward the front lip of the hem reaches, in her own space. */
export function hemFrontZ(tilt: number, takeUp: number): number {
  const length = (RIG.dress.topY - RIG.dress.bottomY) * takeUp;
  // Rotate (0, -length, +rBottom) about x and read off the depth.
  return -length * Math.sin(tilt) + RIG.dress.rBottom * Math.cos(tilt);
}

/**
 * How far her skirt reaches from her own axis while she is crouched — the
 * radius of the cylinder that contains the hem, whichever way it is tilted.
 *
 * Anything she is petting has to stand outside this. Sampled rather than
 * solved: the hem is a circle tilted about one axis and then leaned about the
 * same one, and the furthest point of that is not worth deriving.
 */
export function patSkirtReach(): number {
  const { skirtTilt, skirtTakeUp, lean } = POSTURE.pat;
  const length = (RIG.dress.topY - RIG.dress.bottomY) * skirtTakeUp;
  const total = lean + skirtTilt;
  let reach = 0;

  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * Math.PI * 2;
    const x = RIG.dress.rBottom * Math.sin(phi);
    // The hem point in the skirt's own space, then swung by tilt *and* lean —
    // both are rotations about x, so they simply add.
    const ring = RIG.dress.rBottom * Math.cos(phi);
    const z = -length * Math.sin(total) + ring * Math.cos(total);
    // The waist moves forward with the lean, carrying the hem with it.
    const waist = RIG.dress.topY * Math.sin(lean);
    reach = Math.max(reach, Math.hypot(x, z + waist));
  }
  return reach;
}

/**
 * The front lip of her hem while she is crouched, in world space.
 *
 * This is the thing the animal has to stay clear of: the skirt swings and
 * drops with her whole torso, so where the hem ends up is not obvious from
 * looking at the pose numbers, and getting it wrong reads *very* badly.
 */
export function patHemFront(): { y: number; z: number } {
  const { skirtTilt, skirtTakeUp, lean } = POSTURE.pat;
  const y = hemFrontY(skirtTilt, skirtTakeUp);
  const z = hemFrontZ(skirtTilt, skirtTakeUp);
  return {
    y: y * Math.cos(lean) - z * Math.sin(lean) - crouchDrop(),
    z: y * Math.sin(lean) + z * Math.cos(lean),
  };
}

/** How high the hip sits above the seat surface when she is sitting on it. */
export const SEAT_HIP_LIFT = RIG.hipY;

/**
 * Where the foot ends up, measured from the hip, for a given thigh and shin
 * angle. Both joints rotate about x, so this is plane trigonometry: the thigh
 * hangs from the hip, the shin hangs from the knee, and the shin's angle is
 * relative to the thigh.
 */
export function footFromHip(
  thigh: number,
  shin: number,
): { forward: number; drop: number } {
  const thighLen = RIG.kneeAt;
  const shinLen = RIG.legLength - RIG.kneeAt;
  const toe = RIG.shoe.drop + RIG.shoe.height / 2;

  const kneeForward = Math.sin(-thigh) * thighLen;
  const kneeDrop = Math.cos(thigh) * thighLen;

  const ankleAngle = thigh + shin;
  const forward = kneeForward + Math.sin(-ankleAngle) * (shinLen + toe);
  const drop = kneeDrop + Math.cos(ankleAngle) * (shinLen + toe);

  return { forward, drop };
}

/**
 * The height of the *front* lip of the hem, measured in the avatar's own
 * space, for a given tilt and take-up.
 *
 * Tilting the skirt forward about the waist swings the front of the hem
 * circle upward as well as outward — which is the part that decides whether
 * her knees are visible, so it is worth computing rather than eyeballing.
 */
export function hemFrontY(tilt: number, takeUp: number): number {
  const length = (RIG.dress.topY - RIG.dress.bottomY) * takeUp;
  // Rotate (0, -length, +rBottom) about x and read off the height.
  return (
    RIG.dress.topY -
    length * Math.cos(tilt) -
    RIG.dress.rBottom * Math.sin(tilt)
  );
}

/** Height of the knee, in the avatar's own space, for a thigh angle. */
export function kneeY(thigh: number): number {
  return RIG.hipY - Math.cos(thigh) * RIG.kneeAt;
}

export const BLINK = { period: 4.6, duration: 0.13, close: 0.92 } as const;

/**
 * Vertical scale of the eye at time `t`, in seconds. Blinking is the cheapest
 * thing that makes a face look alive rather than painted; a fixed period keeps
 * both eyes in sync for free, with no shared state between them.
 */
export function blinkScale(t: number): number {
  const phase = ((t % BLINK.period) + BLINK.period) % BLINK.period;
  if (phase > BLINK.duration) return 1;
  return 1 - Math.sin((phase / BLINK.duration) * Math.PI) * BLINK.close;
}

/** Height of the bottom of the shoe when the leg hangs straight. */
export function shoeBottomY(): number {
  return RIG.hipY - RIG.legLength - RIG.shoe.drop - RIG.shoe.height / 2;
}

/**
 * Blend a stand-pose value toward a posed one. Sitting down has to be a
 * movement, not a swap: snapping between two sets of joint angles on the frame
 * the key is pressed is the single thing that makes a character read as a
 * puppet rather than a person.
 */
export function blend(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
