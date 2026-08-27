/**
 * Where she is sitting, if she is sitting.
 *
 * ponytail: module-level mutable state, read inside the player's frame loop —
 * the same shape as `input.ts` and for the same reason. The furniture writes
 * it when she sits down; the controller reads it every frame. Routing it
 * through React would mean the whole tree re-renders on the frame she sits,
 * and the pose is read 60 times a second regardless.
 */

import { RIG } from "./rig.ts";

export type Posture = "stand" | "sit" | "lie";

export type Seat = {
  x: number;
  /**
   * The height of the surface she is resting on — the top of the cushion, the
   * top of the duvet. *Not* where the avatar's origin goes: her hip joint sits
   * a fixed `RIG.hipY` above that origin, so the two differ by her whole
   * upper-leg length. `poseHeight()` does the conversion in one place.
   */
  y: number;
  z: number;
  /** Which way she faces, radians about Y. */
  facing: number;
  posture: Exclude<Posture, "stand">;
  /** Whose seat it is, so the piece knows to offer "stand up" instead. */
  ownerId: string;
};

export const seating: { current: Seat | null } = { current: null };

/**
 * Sitting down is read every frame by the controller *and* has to change one
 * prompt in the DOM — "Sit on the sofa" becomes "Get up". So this is both a
 * plain mutable ref and a subscribable store: the frame loop takes the ref, and
 * the one component that needs to re-render subscribes. Same shape as
 * `interaction/registry.ts`, and deliberately free of React so the maths above
 * stays testable in plain node.
 */
const listeners = new Set<() => void>();

export function subscribeToSeating(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whose seat she is in, or null. The snapshot has to be a primitive, or
 *  `useSyncExternalStore` re-renders forever comparing fresh objects. */
export function seatedOwner(): string | null {
  return seating.current?.ownerId ?? null;
}

function notify() {
  for (const listener of listeners) listener();
}

export function sitAt(seat: Seat) {
  seating.current = seat;
  notify();
}

export function standUp() {
  if (!seating.current) return;
  seating.current = null;
  notify();
}

/** True while she is using this particular piece. */
export function isSeatedAt(ownerId: string): boolean {
  return seating.current?.ownerId === ownerId;
}

/**
 * How far her back sits above the surface she is lying on. A shade under the
 * radius of her head, so it settles into the pillow instead of hovering over
 * it.
 */
const LIE_LIFT = 0.2;

/**
 * Where the avatar's origin goes for a given seat.
 *
 * Sitting, her hips have to land on the cushion, and her origin is the point
 * her hips are measured from — so it drops below the seat, and below the floor
 * for a low chair. That is correct: the origin is "where her feet are when she
 * is standing up", and she is not.
 */
export function poseHeight(seat: Seat): number {
  return seat.posture === "sit" ? seat.y - RIG.hipY : seat.y + LIE_LIFT;
}

/**
 * How long the change of pose takes, in seconds. Long enough to read as a
 * movement, short enough that it never feels like waiting for an animation.
 */
export const POSE_SECONDS = 0.42;
