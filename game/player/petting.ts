/**
 * Petting an animal.
 *
 * The gesture is a duet: she crouches and strokes, the rabbit comes over and
 * leans into her hand. Both halves read their timing from the pure functions
 * below rather than each running its own timer, because two clocks drift and
 * the moment her hand is at the bottom of a stroke is exactly the moment the
 * rabbit has to flatten its ears.
 *
 * ponytail: module-level mutable state read inside frame loops, plus a
 * subscription for the one prompt that has to re-render — the same shape as
 * `seat.ts` and `input.ts`, and for the same reason.
 */

export type Pet = {
  /** Which animal is being petted. */
  ownerId: string;
  /** Where the animal was standing when she reached out — she turns to this,
   *  not to where it has hopped since, or the two chase each other. */
  x: number;
  z: number;
  /**
   * Where she is standing, written by the player controller every frame. The
   * animal comes to her hand, so it has to know where her hand is.
   */
  playerX: number;
  playerZ: number;
  playerFacing: number;
  /** Seconds since she reached out, advanced by the player controller. */
  elapsed: number;
};

export const PET = {
  /** Going down onto her heels. */
  crouch: 0.42,
  /** How long the animal has to reach her hand. */
  approach: 0.75,
  /** Strokes per second. */
  strokeHz: 1.15,
  /** Standing back up. */
  release: 0.55,
  /** How long the whole thing lasts. */
  hold: 2.6,
} as const;

export const PET_SECONDS = PET.approach + PET.hold + PET.release;

/**
 * How many hops the animal takes on its way over. One: covering the whole
 * distance in a single bound is both what a rabbit does and the only way the
 * hop keeps a believable arc — two hops inside `approach` seconds is the same
 * ground covered at twice the vertical speed, which reads as a bounce.
 */
export const APPROACH_HOPS = 1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smoothstep. Linear ramps in and out of a pose read as mechanical. */
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * How far into the crouch she is, 0..1 — down over `PET.crouch`, held, and
 * back up over `PET.release`. Zero at both ends, so the pose can never be left
 * half-applied when the gesture clears.
 */
export function crouchWeight(elapsed: number): number {
  const left = PET_SECONDS - elapsed;
  if (elapsed <= 0 || left <= 0) return 0;
  return smooth(clamp01(Math.min(elapsed / PET.crouch, left / PET.release)));
}

/** How far the animal has got on its way to her hand, 0..1. */
export function approachWeight(elapsed: number): number {
  return smooth(clamp01(elapsed / PET.approach));
}

/** How much of the stroke is happening: 0 until it arrives, 0 again as she
 *  stands up. Both her arm and its ears are scaled by this. */
export function strokeWeight(elapsed: number): number {
  const left = PET_SECONDS - elapsed;
  return smooth(
    clamp01(Math.min((elapsed - PET.approach) / 0.3, left / PET.release)),
  );
}

/**
 * The stroke itself, -1..1: -1 at the top of the sweep, +1 with her hand down
 * on its back. Faded in and out by `strokeWeight`, so the first stroke starts
 * from a still hand rather than snapping into a sine wave.
 */
export function strokeOffset(elapsed: number): number {
  const since = elapsed - PET.approach;
  if (since <= 0) return 0;
  return -Math.cos(since * Math.PI * 2 * PET.strokeHz) * strokeWeight(elapsed);
}

export const petting: { current: Pet | null } = { current: null };

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToPetting(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Which animal is being petted, or null. A primitive, because
 *  `useSyncExternalStore` re-renders forever on a fresh object. */
export function petOwner(): string | null {
  return petting.current?.ownerId ?? null;
}

/** Reach out to an animal standing at (x, z). */
export function startPet(ownerId: string, x: number, z: number) {
  petting.current = {
    ownerId,
    x,
    z,
    // Filled in by the controller on its next frame. Until then the animal's
    // own position is the safest guess: it makes the first frame a no-op
    // instead of a jump toward the world origin.
    playerX: x,
    playerZ: z,
    playerFacing: 0,
    elapsed: 0,
  };
  notify();
}

export function endPet() {
  if (!petting.current) return;
  petting.current = null;
  notify();
}
