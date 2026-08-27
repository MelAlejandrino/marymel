import {
  APPROACH_HOPS,
  approachWeight,
  strokeOffset,
  strokeWeight,
  type Pet,
} from "../player/petting.ts";
import { patHand, patHandBottom } from "../player/rig.ts";
import { hashRandom, isClear, scatter, type Placement } from "./scatter.ts";

/**
 * The rabbits: proportions, where they live, and the maths of a hop.
 *
 * Kept out of the component because all three got it wrong the first time —
 * every rabbit spawned inside a bush, a rabbit that only bobs on the spot
 * reads as broken, and a rabbit sized by eye is one her hand passes straight
 * through when she crouches to pet it. The numbers here are checked in
 * `critters.test.ts` against the avatar's own rig.
 */

/**
 * The bushes, hoisted out of `Garden.tsx` so the rabbits can be kept out of
 * them. A bush is bigger than a rabbit, so one placed in a bush is simply gone.
 */
export const BUSHES = scatter(46, 53, { minScale: 0.75, maxScale: 1.5 });

/** Radius of the little loop each rabbit hops around its home point. */
export const LOOP_RADIUS = 1.3;
/** Seconds per hop. */
export const HOP_SECONDS = 0.85;
/** Radians of the loop covered per hop. */
export const HOP_TURN = 0.55;
/** How high a hop takes it off the grass, at scale 1. */
export const HOP_HEIGHT = 0.3;
/** Hops in a bout, then a pause to graze — counted in hops, not seconds, so
 *  the pause always begins with its feet on the ground. */
const BOUT_HOPS = 5;
const GRAZE_HOPS = 3.2;
/** How long it takes to settle into and out of a graze, in hops. */
const GRAZE_EASE = 0.45;

/**
 * A rabbit, at scale 1. Every offset is measured from the part it hangs off:
 * the face is relative to the centre of the head, the way `FACE` is in the
 * avatar's rig.
 *
 * The silhouette is the whole game: a big round rear, a dip, a smaller raised
 * chest, and ears longer than the head is tall. Get those four right and even
 * a pile of spheres reads as a rabbit.
 */
export const RABBIT = {
  /** Roughly its hips — the point the whole body tips about. */
  hip: { y: 0.115, z: -0.06 },
  /** The rear. Deliberately the biggest thing on the animal. */
  haunch: { r: 0.175, y: 0.185, z: -0.1 },
  /** Raised chest, forward and smaller: this is what dips the back. */
  chest: { r: 0.14, y: 0.165, z: 0.115 },
  /** Fills underneath, so the two blobs read as one body. */
  belly: { r: 0.125, y: 0.14, z: 0.01 },
  head: { r: 0.125, y: 0.315, z: 0.235 },
  /** Stands proud of the face — a rabbit's whole front end tapers. */
  muzzle: { r: 0.072, y: -0.038, z: 0.082 },
  cheek: { r: 0.058, x: 0.078, y: -0.028, z: 0.042 },
  nose: { r: 0.021, y: -0.014, z: 0.148 },
  /** Set wide and high on the sides of the head, the way prey animals are. */
  eye: { x: 0.095, y: 0.042, z: 0.058, r: 0.029 },
  catchlight: { dx: -0.007, dy: 0.01, dz: 0.019, r: 0.008 },
  ear: {
    /** Base, on top of the head and a little back. */
    x: 0.052,
    y: 0.088,
    z: -0.025,
    /** Longer than its head is tall. This is the single most rabbit thing
     *  about a rabbit, and the first version got it wrong. */
    length: 0.28,
    r: 0.046,
    /** Ears are flat, not round: squashed front to back. */
    flatten: 0.44,
    /** Splayed out and tipped back a little at rest. */
    spread: 0.2,
    tilt: -0.1,
    /** The pink inside, sitting on the front face of the ear. */
    inner: { r: 0.03, z: 0.016, drop: 0.02 },
  },
  frontPaw: { x: 0.072, y: 0.052, z: 0.185, r: 0.048 },
  /** Long flat hind feet, pointing forward — the other half of what makes a
   *  rabbit read as a rabbit. */
  hindFoot: { x: 0.108, y: 0.042, z: 0.005, w: 0.082, h: 0.058, l: 0.2 },
  tail: { r: 0.072, y: 0.235, z: -0.255 },
  whisker: { y: -0.03, z: 0.1, length: 0.135, r: 0.0035, rows: [0.22, 0, -0.22] },
  /** Nose down into the grass while grazing. */
  graze: 0.34,
  /** Lift while it tips back to meet her hand, so its hind feet stay planted. */
  rearLift: 0.02,
  /** Ears flat back, the way a happy rabbit's go when it is being stroked. */
  earsBack: -1,
} as const;

/** How tall a rabbit stands, ears up, at a given scale. */
export function rabbitHeight(scale = 1): number {
  const { head, ear } = RABBIT;
  return (head.y + ear.y + ear.length * Math.cos(ear.tilt) + ear.r) * scale;
}

/**
 * How far this rabbit tips back so the top of its head lands exactly under her
 * palm at the bottom of a stroke.
 *
 * Solved rather than guessed, and solved per rabbit: they are not all the same
 * size, so one fixed angle would leave the small ones batting at her hand and
 * put the big ones' heads through it. Rearing up to meet a hand is also simply
 * what rabbits do.
 */
export function rearAngle(scale: number): number {
  const { hip, head, rearLift } = RABBIT;
  // Head height after tipping by t about the hip is
  //   hip.y + dy cos t - dz sin t + rearLift + head.r
  // i.e. base + radius * cos(t - phase). Invert that for t.
  const dy = head.y - hip.y;
  const dz = head.z - hip.z;
  const radius = Math.hypot(dy, dz);
  const phase = Math.atan2(-dz, dy);
  const base = hip.y + rearLift + head.r;
  const want = patHandBottom(1) / scale;

  const cosine = (want - base) / radius;
  if (Math.abs(cosine) > 1) return 0;
  // Two solutions; the near one is a small tip rather than sitting bolt
  // upright. Clamped, because "meet her hand" must never become a backflip.
  return Math.min(0.22, Math.max(-0.55, phase + Math.acos(cosine)));
}

/** The centre of a petted rabbit's head. */
export function pettedHeadY(scale: number): number {
  const { hip, head, rearLift } = RABBIT;
  const tip = rearAngle(scale);
  const dy = head.y - hip.y;
  const dz = head.z - hip.z;
  return (hip.y + dy * Math.cos(tip) - dz * Math.sin(tip) + rearLift) * scale;
}

/** The top of a petted rabbit's head — what her palm comes to rest on. */
export function pettedHeadTop(scale: number): number {
  return pettedHeadY(scale) + RABBIT.head.r * scale;
}

/** How far in front of its own origin its head sits, once tipped back. */
export function pettedHeadOffset(scale: number): number {
  const { hip, head } = RABBIT;
  const tip = rearAngle(scale);
  const dy = head.y - hip.y;
  const dz = head.z - hip.z;
  return (hip.z + dy * Math.sin(tip) + dz * Math.cos(tip)) * scale;
}

/**
 * How far the rabbit turns away from her while she pets it: side-on.
 *
 * Not nose-first. A rabbit that comes at her head-first ends up with its face
 * in her lap and its nose under her hem — her arm is barely longer than her
 * skirt is wide, so there is no version of that framing which reads as petting
 * an animal. Side-on, it stands beside her knee, she strokes along its back,
 * and its nose points across her rather than at her.
 */
export const PET_TURN = 1.45;

/**
 * Where a petted rabbit stands and which way it faces, in her own space —
 * head under her palm, body turned side-on and angled away from her.
 */
export function petLayout(scale: number): {
  head: { x: number; z: number };
  face: { x: number; z: number };
  origin: { x: number; z: number };
  yaw: number;
} {
  const hand = patHand();
  const distance = Math.hypot(hand.x, hand.z) || 1;
  // Which way it would face coming straight at her, turned away by PET_TURN.
  const toHer = { x: -hand.x / distance, z: -hand.z / distance };
  const cos = Math.cos(PET_TURN);
  const sin = Math.sin(PET_TURN);
  const face = {
    x: toHer.x * cos + toHer.z * sin,
    z: -toHer.x * sin + toHer.z * cos,
  };
  const offset = pettedHeadOffset(scale);

  return {
    head: { x: hand.x, z: hand.z },
    face,
    // Its head is `offset` in front of its origin, so its origin sits back
    // along its own facing — which puts its body out to her side, not across
    // the front of her.
    origin: { x: hand.x - face.x * offset, z: hand.z - face.z * offset },
    yaw: Math.atan2(face.x, face.z),
  };
}

/** Where its nose ends up in her space. The one point that has to stay well
 *  clear of her, and the reason `PET_TURN` exists. */
export function pettedNose(scale: number): { x: number; y: number; z: number } {
  const { head, face } = petLayout(scale);
  const { nose } = RABBIT;
  const tip = rearAngle(scale);
  // Tipping back swings the nose up and shortens its reach forward.
  const up = (nose.y * Math.cos(tip) - nose.z * Math.sin(tip)) * scale;
  const forward = (nose.y * Math.sin(tip) + nose.z * Math.cos(tip)) * scale;

  return {
    x: head.x + face.x * forward,
    y: pettedHeadY(scale) + up,
    z: head.z + face.z * forward,
  };
}

/** Where a rabbit has to stand for its head to be under her hand. */
export function petSpot(
  pet: { playerX: number; playerZ: number; playerFacing: number },
  scale: number,
): { x: number; z: number } {
  const { origin } = petLayout(scale);
  const sin = Math.sin(pet.playerFacing);
  const cos = Math.cos(pet.playerFacing);
  // Her local +z is whichever way she is facing.
  return {
    x: pet.playerX + origin.x * cos + origin.z * sin,
    z: pet.playerZ - origin.x * sin + origin.z * cos,
  };
}

/** Which way it faces while she pets it, in world space. */
export function petFacing(
  pet: { playerFacing: number },
  scale: number,
): number {
  return pet.playerFacing + petLayout(scale).yaw;
}

/**
 * Home points in the front garden, between the gate and the cottage — the
 * stretch she actually walks, because the whole point is that she sees them.
 * Rejected against the bushes, the path and each other, with room for the loop.
 */
export function rabbitHomes(count: number, seed = 71): Placement[] {
  const out: Placement[] = [];
  const clearance = LOOP_RADIUS + 0.7;

  for (let i = 0; out.length < count && i < count * 400; i++) {
    const n = seed + i * 5;
    const x = (hashRandom(n) * 2 - 1) * 12;
    const z = 3 + hashRandom(n + 1) * 15;

    if (!isClear(x, z, 1.5 + clearance)) continue;
    // 0.55 is the bush geometry's radius, before its own scale.
    if (BUSHES.some((b) => Math.hypot(b.x - x, b.z - z) < clearance + b.scale * 0.55))
      continue;
    if (out.some((r) => Math.hypot(r.x - x, r.z - z) < clearance * 2.5)) continue;

    out.push({
      x,
      z,
      rotation: hashRandom(n + 2) * Math.PI * 2,
      // Kept a narrow range on purpose: a rabbit has to be the height of her
      // hand, and `rearAngle` can only make up so much of the difference.
      scale: 0.94 + hashRandom(n + 3) * 0.2,
    });
  }
  return out;
}

/**
 * How far round the loop a rabbit has got at time `t` (measured in hops), and
 * how high off the ground it is (0..1).
 *
 * Travel stalls at each landing — the sine term's derivative cancels the
 * linear one at whole `t` — so it reads as hop, pause, hop instead of sliding
 * round a circle with a bobbing body.
 */
export function hopAt(t: number): { travelled: number; height: number } {
  const u = t - Math.floor(t);
  return {
    travelled: t - Math.sin(2 * Math.PI * u) / (2 * Math.PI),
    height: Math.sin(Math.PI * u) ** 2,
  };
}

/**
 * The rabbit's own clock: a bout of hops, then a pause with its nose in the
 * grass, then another bout.
 *
 * Time *stops* during the graze rather than the position being overridden, so
 * it starts hopping again from exactly where it stopped and nothing has to be
 * interpolated back.
 *
 * @returns `t` in hops, for `hopAt`, and `graze` 0..1.
 */
export function hopTime(
  seconds: number,
  phase: number,
): { t: number; graze: number } {
  const span = BOUT_HOPS + GRAZE_HOPS;
  const raw = seconds / HOP_SECONDS + phase * span;
  const bout = Math.floor(raw / span);
  const within = raw - bout * span;
  const resting = within - BOUT_HOPS;

  return {
    t: bout * BOUT_HOPS + Math.min(within, BOUT_HOPS),
    graze:
      resting <= 0
        ? 0
        : Math.min(1, resting / GRAZE_EASE, (GRAZE_HOPS - resting) / GRAZE_EASE),
  };
}

/** Where a rabbit is, and what shape it is in, at one instant. */
export type RabbitPose = {
  x: number;
  z: number;
  /** How far off the grass, in world units. */
  lift: number;
  /** Body pitch about the hip: negative is nose up. */
  pitch: number;
  /** Which way it wants to face. */
  yaw: number;
  /** 0..1 airtime, for the ears and the squash. */
  air: number;
  /** 0..1 nose in the grass. */
  graze: number;
  /** -1..1 where her hand is in its stroke, 0 if nobody is petting it. */
  stroke: number;
  /** 0..1 how much of the being-petted pose applies. */
  petted: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The whole of a rabbit's motion, as a function of the clock.
 *
 * Pure on purpose, and out here rather than in the component: this is the part
 * that has to be *right* — it hops, it grazes, and when she reaches out it
 * comes over and puts its head under her hand — and none of that can be
 * checked by looking at a screenshot of one frame.
 *
 * @param anchor where it was standing when she reached out, so it walks from
 *   there rather than from wherever its loop has since moved on to.
 */
export function rabbitPose({
  home,
  scale,
  phase,
  seconds,
  pet,
  anchor,
}: {
  home: Placement;
  scale: number;
  phase: number;
  seconds: number;
  pet: Pet | null;
  anchor: { x: number; z: number } | null;
}): RabbitPose {
  const { t, graze } = hopTime(seconds, phase);
  const { travelled, height } = hopAt(t);
  const u = t - Math.floor(t);
  const angle = home.rotation + travelled * HOP_TURN;

  const loop = {
    x: home.x + Math.cos(angle) * LOOP_RADIUS,
    z: home.z + Math.sin(angle) * LOOP_RADIUS,
  };
  // Nose up as it leaves the ground, down as it comes back: a hop that stays
  // level reads as an object being moved rather than an animal moving itself.
  const hopPitch = -Math.sin(u * Math.PI * 2) * 0.22 + graze * 0.12;

  if (!pet) {
    return {
      ...loop,
      lift: height * HOP_HEIGHT * scale,
      pitch: hopPitch,
      yaw: -angle,
      air: height,
      graze,
      stroke: 0,
      petted: 0,
    };
  }

  // Being petted: a couple of hops over to her, then it tips back onto its
  // haunches so the top of its head ends up exactly at her palm.
  const journey = approachWeight(pet.elapsed);
  const spot = petSpot(pet, scale);
  const from = anchor ?? loop;
  const x = lerp(from.x, spot.x, journey);
  const z = lerp(from.z, spot.z, journey);
  const air = hopAt(journey * APPROACH_HOPS).height * (1 - journey);
  const petted = strokeWeight(pet.elapsed);

  return {
    x,
    z,
    lift: air * HOP_HEIGHT * scale + RABBIT.rearLift * scale * journey,
    pitch: lerp(hopPitch, rearAngle(scale), journey),
    // Side-on to her, with a happy little wiggle under her hand.
    yaw: petFacing(pet, scale) + Math.sin(seconds * 7.5) * 0.06 * petted,
    air,
    graze: 0,
    stroke: strokeOffset(pet.elapsed),
    petted,
  };
}
