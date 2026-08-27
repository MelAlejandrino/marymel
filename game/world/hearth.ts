/**
 * How hard the fire is burning.
 *
 * ponytail: module-level mutable state, like `input.ts` and `seat.ts`. The log
 * basket is a piece of furniture and the fire is part of the building, so one
 * of them has to reach the other; a shared number read in a frame loop is the
 * whole mechanism, and it decays on its own rather than needing a timer.
 */
export const hearth = {
  /** 0..1 of extra brightness on top of the fire's resting glow. */
  blaze: 0,
};

/** Seconds for a fresh log to burn back down to the resting glow. */
export const BLAZE_SECONDS = 9;

export function stokeFire() {
  hearth.blaze = 1;
}

/** Ease the blaze back down. Returns the new value; pure, so it is testable. */
export function decayBlaze(blaze: number, delta: number): number {
  return Math.max(0, blaze - delta / BLAZE_SECONDS);
}

/**
 * The fire's light intensity for a given blaze, with a flicker. A fire that
 * sits at one constant brightness is the thing that makes a room read as lit
 * by a light bulb painted orange.
 */
export function fireIntensity(blaze: number, elapsed: number): number {
  const flicker =
    Math.sin(elapsed * 7.3) * 0.5 + Math.sin(elapsed * 3.1 + 1.7) * 0.5;
  const base = 22 + blaze * 30;
  return base * (1 + flicker * 0.06);
}
