/**
 * The claw machine, as pure state.
 *
 * All of it — aiming, dropping, gripping, lifting, delivering, releasing and
 * the capsule's fall down the chute — is a plain reducer over time. Nothing
 * here knows about three.js, so the whole machine can be driven and checked
 * without a renderer, and the renderer only reads.
 *
 * Heights are real machine-local units rather than a 0..1 fraction, because
 * the capsule has to fall under gravity and land in the right place.
 *
 * ponytail: still no physics engine. Capsules do not roll and nothing stacks;
 * a grab is "was the claw over it", and the fall is one integrated axis. That
 * is the whole feel of a real claw machine.
 */

import { BOUNDS, CHUTE, GRAB_Y, HANG, PLAY } from "./geometry.ts";

// Re-exported so callers and tests have one place to import from.
export { BOUNDS, CHUTE, GRAB_Y, HANG, PLAY };

/**
 * How close the claw must be to a capsule to close on it. Generous on purpose:
 * a gift should not be stingy. This is feel, not geometry, so it lives here.
 */
export const GRAB_RADIUS = 0.135;

const AIM_SPEED = 0.62;
const DROP_SPEED = 0.95;
const LIFT_SPEED = 0.78;
const TRAVERSE_SPEED = 0.52;
const GRIP_SPEED = 3.4;
const RELEASE_SPEED = 4.2;
const GRAVITY = 3.4;
/** A beat at the bottom before the prongs close, so the shot reads as taken. */
const SETTLE_TIME = 0.18;
/**
 * How quickly the hanging claw catches up to the gantry. Lower means more
 * swing; this is the single biggest contributor to the machine feeling
 * mechanical rather than like a cursor.
 */
const HANG_LAG = 7.5;
/** Grip has to open this far before the capsule lets go. */
const RELEASE_AT = 0.35;
/** A long frame must not let the claw skip a phase. */
const MAX_STEP = 1 / 20;

export type ClawPhase =
  | "aiming"
  | "dropping"
  | "settling"
  | "closing"
  | "lifting"
  | "returning"
  | "releasing"
  | "falling"
  | "done";

export type Capsule = {
  x: number;
  z: number;
  /**
   * Already won. Kept in the list rather than removed so indices stay stable
   * for the whole session — `grabbed` is an index, and resizing the array
   * under it would point it at a different capsule.
   */
  taken?: boolean;
};

export type ClawState = {
  phase: ClawPhase;
  /** Where the gantry is being driven to. */
  x: number;
  z: number;
  /** Where the claw actually hangs — lags the gantry, which is the swing. */
  hangX: number;
  hangZ: number;
  /** Height of the claw hub. */
  clawY: number;
  /** 0 open, 1 shut. */
  grip: number;
  /** Index into the capsule list, once the claw has closed on one. */
  grabbed: number | null;
  /** The held or falling capsule. Null on a miss, and before the grab. */
  prize: { x: number; y: number; z: number } | null;
  prizeVelY: number;
  /** Seconds spent in a timed phase. */
  timer: number;
};

export type ClawInput = {
  /** -1..1 on each axis; `y` is away from the player. */
  move: { x: number; y: number };
  /** Edge-triggered: true on the frame the drop is asked for. */
  drop: boolean;
};

export function createClaw(): ClawState {
  return {
    phase: "aiming",
    x: 0,
    z: 0,
    hangX: 0,
    hangZ: 0,
    clawY: PLAY.parkY,
    grip: 0,
    grabbed: null,
    prize: null,
    prizeVelY: 0,
    timer: 0,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Frame-rate independent smoothing, same as the player camera uses. */
const damp = (current: number, target: number, lambda: number, dt: number) =>
  target + (current - target) * Math.exp(-lambda * dt);

/**
 * Which capsule the claw closes on, or null for a miss. The nearest one wins,
 * and ties break on index so the same shot always gives the same result.
 */
export function attemptGrab(
  capsules: readonly Capsule[],
  claw: { x: number; z: number },
  radius = GRAB_RADIUS,
): number | null {
  let best: number | null = null;
  let bestDistSq = radius * radius;

  for (let i = 0; i < capsules.length; i++) {
    if (capsules[i].taken) continue;
    const dx = capsules[i].x - claw.x;
    const dz = capsules[i].z - claw.z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= bestDistSq) {
      // `<=` with a shrinking bound means an exact tie keeps the lower index.
      if (best === null || distSq < bestDistSq) {
        best = i;
        bestDistSq = distSq;
      }
    }
  }

  return best;
}

/**
 * Whether dropping right now would catch something. Drives the aim ring on the
 * floor — without it, aiming is guesswork and the machine feels arbitrary.
 */
export function wouldGrab(
  capsules: readonly Capsule[],
  claw: { x: number; z: number },
): boolean {
  return attemptGrab(capsules, claw) !== null;
}

/** Phases where the claw is holding the capsule rather than dropping it. */
const CARRYING: ReadonlySet<ClawPhase> = new Set<ClawPhase>([
  "closing",
  "lifting",
  "returning",
  "releasing",
]);

/** Advance the machine by `dt` seconds. Returns a new state; never mutates. */
export function stepClaw(
  state: ClawState,
  input: ClawInput,
  dt: number,
  capsules: readonly Capsule[],
): ClawState {
  const step = Math.min(Math.max(dt, 0), MAX_STEP);
  const next: ClawState = { ...state };

  switch (state.phase) {
    case "aiming": {
      next.x = clamp(state.x + input.move.x * AIM_SPEED * step, -BOUNDS.x, BOUNDS.x);
      // Screen-forward is away from the player, which is -z.
      next.z = clamp(state.z - input.move.y * AIM_SPEED * step, -BOUNDS.z, BOUNDS.z);
      if (input.drop) {
        next.phase = "dropping";
        // Committed: the shot is taken from where the claw *hangs*, so the
        // swing matters and jabbing the stick then dropping is a real miss.
        next.x = state.hangX;
        next.z = state.hangZ;
      }
      break;
    }

    case "dropping": {
      next.clawY = state.clawY - DROP_SPEED * step;
      if (next.clawY <= GRAB_Y) {
        next.clawY = GRAB_Y;
        next.phase = "settling";
        next.timer = 0;
      }
      break;
    }

    case "settling": {
      next.timer = state.timer + step;
      if (next.timer >= SETTLE_TIME) {
        next.phase = "closing";
        next.timer = 0;
        // Decided once, at the bottom, from where the claw actually hangs.
        next.grabbed = attemptGrab(capsules, { x: state.hangX, z: state.hangZ });
      }
      break;
    }

    case "closing": {
      next.grip = Math.min(1, state.grip + GRIP_SPEED * step);
      if (next.grip >= 1) next.phase = "lifting";
      break;
    }

    case "lifting": {
      next.clawY = state.clawY + LIFT_SPEED * step;
      if (next.clawY >= PLAY.parkY) {
        next.clawY = PLAY.parkY;
        // A miss is over as soon as the claw is back up — nothing to deliver.
        next.phase = state.grabbed === null ? "done" : "returning";
      }
      break;
    }

    case "returning": {
      const dx = CHUTE.x - state.x;
      const dz = CHUTE.z - state.z;
      const distance = Math.hypot(dx, dz);
      const travel = TRAVERSE_SPEED * step;
      if (distance <= travel || distance === 0) {
        next.x = CHUTE.x;
        next.z = CHUTE.z;
        // Wait for the swing to settle before opening, or the capsule is flung.
        if (Math.hypot(state.hangX - CHUTE.x, state.hangZ - CHUTE.z) < 0.02) {
          next.phase = "releasing";
        }
      } else {
        next.x = state.x + (dx / distance) * travel;
        next.z = state.z + (dz / distance) * travel;
      }
      break;
    }

    case "releasing": {
      next.grip = Math.max(0, state.grip - RELEASE_SPEED * step);
      if (next.grip <= RELEASE_AT) {
        next.phase = "falling";
        next.prizeVelY = 0;
      }
      break;
    }

    case "falling": {
      // One axis of gravity. It only has to look like it fell.
      next.prizeVelY = state.prizeVelY - GRAVITY * step;
      const y = (state.prize?.y ?? PLAY.parkY) + next.prizeVelY * step;
      if (y <= PLAY.chuteFloorY) {
        next.prize = state.prize
          ? { ...state.prize, y: PLAY.chuteFloorY }
          : null;
        next.prizeVelY = 0;
        next.phase = "done";
      } else if (state.prize) {
        // x and z are frozen: it fell out of the claw, it does not steer.
        next.prize = { ...state.prize, y };
      }
      break;
    }

    case "done":
      break;
  }

  // The claw always trails the gantry. Doing this outside the switch means it
  // keeps settling while the machine waits, which is what makes the pause at
  // the chute read as the load steadying rather than a stall.
  next.hangX = damp(state.hangX, next.x, HANG_LAG, step);
  next.hangZ = damp(state.hangZ, next.z, HANG_LAG, step);

  // A held capsule rides under the claw. Assigned after the swing so it stays
  // glued to the prongs instead of lagging a frame behind them.
  if (next.grabbed !== null && CARRYING.has(next.phase)) {
    next.prize = {
      x: next.hangX,
      y: next.clawY - HANG,
      z: next.hangZ,
    };
  }

  return next;
}

/** True once the round is over and the result can be reported. */
export const isFinished = (state: ClawState) => state.phase === "done";

/** True while the player is still in control. */
export const isAiming = (state: ClawState) => state.phase === "aiming";

/**
 * Where the capsules sit. Hand-spread from a hash rather than randomised, so
 * the machine looks the same every time she opens it — and so a shot that
 * missed by a hair can be retried against the same arrangement.
 *
 * Prefix-stable: `capsuleLayout(n)` is the start of `capsuleLayout(n + 1)`, so
 * winning a prize leaves the machine holding the same capsules minus one.
 */
export function capsuleLayout(count: number, seed = 1): Capsule[] {
  const out: Capsule[] = [];
  const minGap = 0.125;
  // Keep the pile out of the chute, or a capsule sits in the hole.
  const chuteClearance = 0.16;

  for (let i = 0, guard = 0; out.length < count && guard < count * 80; i++, guard++) {
    const a = Math.sin((seed + i) * 127.1) * 43758.5453;
    const b = Math.sin((seed + i) * 311.7 + 74.7) * 43758.5453;
    const candidate = {
      x: clamp(
        (a - Math.floor(a) - 0.5) * 2 * (BOUNDS.x - 0.06),
        -BOUNDS.x + 0.06,
        BOUNDS.x - 0.06,
      ),
      z: clamp(
        (b - Math.floor(b) - 0.5) * 2 * (BOUNDS.z - 0.06),
        -BOUNDS.z + 0.06,
        BOUNDS.z - 0.06,
      ),
    };
    if (Math.hypot(candidate.x - CHUTE.x, candidate.z - CHUTE.z) < chuteClearance) {
      continue;
    }
    if (out.some((c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) < minGap)) {
      continue;
    }
    out.push(candidate);
  }

  return out;
}
