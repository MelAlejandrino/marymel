/**
 * Input arrives in camera space ("push up" means "away from the camera"), so
 * it has to be rotated into world space by the camera's yaw before it can
 * move anything.
 */

export type Vec2 = { x: number; z: number };

/**
 * With yaw = 0 the camera sits on +z looking toward -z, so "forward" is -z.
 * `move.y` is forward intent, `move.x` is strafe.
 */
export function moveDirection(
  move: { x: number; y: number },
  yaw: number,
): Vec2 {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: move.x * cos - move.y * sin,
    z: -move.x * sin - move.y * cos,
  };
}

/** Which way the character model should face. Three.js meshes face +z. */
export function facingAngle(dir: Vec2): number {
  return Math.atan2(dir.x, dir.z);
}

/** Where the camera sits, given the player's position and the current yaw. */
export function cameraPosition(
  player: Vec2,
  yaw: number,
  distance: number,
  height: number,
): { x: number; y: number; z: number } {
  return {
    x: player.x + Math.sin(yaw) * distance,
    y: height,
    z: player.z + Math.cos(yaw) * distance,
  };
}

/**
 * Frame-rate independent smoothing. `lambda` is roughly "how sharply it
 * catches up"; the exponential keeps it identical at 60fps and 120fps, which
 * a plain `lerp(a, b, 0.1)` would not be.
 */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/**
 * three's `fov` is the *vertical* angle, so a tall narrow viewport silently
 * crops the view sideways: at a 9:19.5 aspect a 52° vertical fov leaves only
 * ~25° horizontally, which reads as looking down a tunnel.
 *
 * This is the "hor+" convention — hold the horizontal field steady and let the
 * vertical one grow — clamped so an extreme portrait screen does not fisheye.
 */
export function verticalFov(
  horizontalFovDeg: number,
  aspect: number,
  min = 45,
  max = 78,
): number {
  if (!(aspect > 0)) return horizontalFovDeg;
  const h = (horizontalFovDeg * Math.PI) / 180;
  const v = 2 * Math.atan(Math.tan(h / 2) / aspect);
  return Math.min(max, Math.max(min, (v * 180) / Math.PI));
}

/** Normalise an angle to (-pi, pi], so turning always takes the short way. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * How far the head turns away from the body to look where the camera is
 * looking. Walking forward, the body already points that way and this is ~0;
 * standing still while the camera swings, she glances after it.
 *
 * Clamped, because a head that can rotate past the shoulders is the difference
 * between charming and unsettling.
 */
export function headTurn(
  cameraYaw: number,
  bodyFacing: number,
  limit = 0.7,
): number {
  // The camera looks from `cameraYaw` toward the player, so the direction it
  // faces is half a turn from where it sits.
  return clamp(wrapAngle(cameraYaw + Math.PI - bodyFacing), -limit, limit);
}

/**
 * Turn the character toward where she is actually travelling.
 *
 * Steering by velocity rather than by input is the whole point: the moment a
 * key is released the input is (0, 0) while she is still sliding to a stop,
 * and `atan2(0, 0)` is 0 — which used to snap her round to face +z every time
 * you let go.
 *
 * Below `threshold` she keeps her current heading instead of spinning as the
 * last scraps of velocity decay in an arbitrary direction.
 */
export function steer(
  facing: number,
  velocity: Vec2,
  lambda: number,
  dt: number,
  threshold = 0.1,
): number {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed <= threshold) return facing;
  // Take the short way round, so crossing +/-pi does not spin her.
  const diff = wrapAngle(facingAngle(velocity) - facing);
  return damp(facing, facing + diff, lambda, dt);
}
