/**
 * The pose the avatar should be in this frame. A plain mutable object written
 * by the player controller and read by the avatar's own render loop — pose
 * changes every frame, so routing it through props would re-render the tree
 * sixty times a second.
 */
export type AvatarMotion = {
  /** 0..1, how close to full walking speed. */
  gait: number;
  /** Ever-increasing walk-cycle phase, in radians. */
  stride: number;
  /** Head rotation relative to the shoulders, in radians. */
  headYaw: number;
  /** Seconds elapsed, for idle breathing. */
  elapsed: number;
};

export function createMotion(): AvatarMotion {
  return { gait: 0, stride: 0, headYaw: 0, elapsed: 0 };
}
