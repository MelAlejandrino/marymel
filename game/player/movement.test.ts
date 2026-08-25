/** Run: node game/player/movement.test.ts */
import assert from "node:assert/strict";

import {
  cameraPosition,
  damp,
  facingAngle,
  headTurn,
  moveDirection,
  steer,
  verticalFov,
  wrapAngle,
} from "./movement.ts";

const close = (a: number, b: number, msg?: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} !== ${b}`);
const closeVec = (a: { x: number; z: number }, b: { x: number; z: number }) => {
  close(a.x, b.x, `x: ${a.x} !== ${b.x}`);
  close(a.z, b.z, `z: ${a.z} !== ${b.z}`);
};

// yaw 0: camera on +z looking toward -z. Forward must go *into* the scene.
closeVec(moveDirection({ x: 0, y: 1 }, 0), { x: 0, z: -1 });
closeVec(moveDirection({ x: 0, y: -1 }, 0), { x: 0, z: 1 });
closeVec(moveDirection({ x: 1, y: 0 }, 0), { x: 1, z: 0 });
closeVec(moveDirection({ x: -1, y: 0 }, 0), { x: -1, z: 0 });

// Swing the camera a quarter turn: "forward" follows it.
closeVec(moveDirection({ x: 0, y: 1 }, Math.PI / 2), { x: -1, z: 0 });
closeVec(moveDirection({ x: 1, y: 0 }, Math.PI / 2), { x: 0, z: -1 });

// Half a turn reverses it.
closeVec(moveDirection({ x: 0, y: 1 }, Math.PI), { x: 0, z: 1 });

// Rotation must never change how fast you travel.
for (const yaw of [0, 0.7, 1.9, -2.4, Math.PI]) {
  const d = moveDirection({ x: 0.6, y: 0.8 }, yaw); // unit-length input
  close(Math.hypot(d.x, d.z), 1, `speed changed at yaw ${yaw}`);
}

// The character faces where it is going (three.js meshes face +z).
close(facingAngle({ x: 0, z: 1 }), 0);
close(facingAngle({ x: 1, z: 0 }), Math.PI / 2);
close(facingAngle({ x: 0, z: -1 }), Math.PI);

// Walking forward at yaw 0 heads to -z, so the model turns to face -z.
close(facingAngle(moveDirection({ x: 0, y: 1 }, 0)), Math.PI);

// Camera sits behind the player and follows them.
closeVec(cameraPosition({ x: 0, z: 0 }, 0, 6, 3), { x: 0, z: 6 });
closeVec(cameraPosition({ x: 2, z: -1 }, 0, 6, 3), { x: 2, z: 5 });
close(cameraPosition({ x: 0, z: 0 }, 0, 6, 3).y, 3);
closeVec(cameraPosition({ x: 0, z: 0 }, Math.PI / 2, 6, 3), { x: 6, z: 0 });
// Always exactly `distance` away, whatever the yaw.
for (const yaw of [0.3, 1.1, -2.2]) {
  const c = cameraPosition({ x: 1, z: 2 }, yaw, 6, 3);
  close(Math.hypot(c.x - 1, c.z - 2), 6);
}

// Damping converges, never overshoots, and is frame-rate independent.
close(damp(0, 10, 5, 0), 0); // dt 0 changes nothing
assert.ok(damp(0, 10, 5, 0.016) > 0 && damp(0, 10, 5, 0.016) < 10);
// One 1/60s step must match two 1/120s steps.
const oneBigStep = damp(0, 10, 5, 1 / 60);
const twoSmallSteps = damp(damp(0, 10, 5, 1 / 120), 10, 5, 1 / 120);
close(oneBigStep, twoSmallSteps);

// --- field of view ----------------------------------------------------------
// At a square aspect, vertical and horizontal fov are the same angle.
close(verticalFov(60, 1), 60);

// Portrait must widen the vertical fov, or the horizontal view gets cropped.
const portrait = verticalFov(60, 9 / 19.5);
assert.ok(portrait > 60, `portrait should widen fov, got ${portrait}`);

// Landscape narrows it.
assert.ok(verticalFov(60, 16 / 9) < 60);

// Round-tripping back to horizontal returns the angle asked for. Only valid
// between roughly 0.71 and 1.39, where neither clamp is engaged.
for (const aspect of [0.75, 0.9, 1, 1.2, 1.35]) {
  const v = verticalFov(60, aspect);
  const h = (2 * Math.atan(Math.tan((v * Math.PI) / 360) * aspect) * 180) / Math.PI;
  close(h, 60, `round trip at aspect ${aspect}`);
}

// The clamp holds at extremes rather than producing a fisheye or a pinhole.
assert.ok(verticalFov(60, 0.2) <= 78, "must clamp on very tall screens");
assert.ok(verticalFov(60, 12) >= 45, "must clamp on very wide screens");

// Degenerate sizes (a zero-height container on first layout) must not produce
// NaN and blank the screen.
assert.equal(verticalFov(60, 0), 60);
assert.equal(verticalFov(60, Number.NaN), 60);

// --- angles -----------------------------------------------------------------
close(wrapAngle(0), 0);
close(wrapAngle(Math.PI * 2), 0);
close(wrapAngle(Math.PI * 3), Math.PI);
close(wrapAngle(-Math.PI * 1.5), Math.PI / 2);
for (const a of [0.3, 3, -3, 7, -7, 100]) {
  assert.ok(Math.abs(wrapAngle(a)) <= Math.PI + 1e-9, `wrapAngle out of range for ${a}`);
}

// --- head tracking ----------------------------------------------------------
// Walking straight ahead: the body already points where the camera looks, so
// the head stays level with the shoulders.
for (const yaw of [0, 1.1, -2.4, Math.PI]) {
  const bodyFacing = facingAngle(moveDirection({ x: 0, y: 1 }, yaw));
  close(headTurn(yaw, bodyFacing), 0, `head should be straight at yaw ${yaw}`);
}

// Standing still while the camera swings: she glances after it.
const bodyNorth = facingAngle(moveDirection({ x: 0, y: 1 }, 0));
assert.ok(headTurn(0.4, bodyNorth) > 0, "head follows the camera one way");
assert.ok(headTurn(-0.4, bodyNorth) < 0, "and the other");
close(headTurn(0.4, bodyNorth), 0.4, "small turns are followed exactly");

// Never past the shoulders, whichever way the camera goes.
for (const yaw of [0, 2, -2, 3, -3, 6, -6]) {
  const turn = headTurn(yaw, bodyNorth);
  assert.ok(Math.abs(turn) <= 0.7 + 1e-9, `head over-rotated to ${turn}`);
}
// Facing directly away is the extreme, and it clamps rather than snapping.
assert.equal(Math.abs(headTurn(Math.PI, bodyNorth)), 0.7);

// --- steering ---------------------------------------------------------------
const NORTH = facingAngle({ x: 0, z: -1 }); // walking away from the camera
const dt = 1 / 60;

// Standing still: she holds her heading rather than drifting.
close(steer(NORTH, { x: 0, z: 0 }, 14, dt), NORTH, "still");
close(steer(NORTH, { x: 0.01, z: 0.01 }, 14, dt), NORTH, "below threshold");

// Walking north, she settles on north and stays there.
let f = 2;
for (let i = 0; i < 200; i++) f = steer(f, { x: 0, z: -4 }, 14, dt);
close(f, NORTH, "should settle facing north");

// THE REGRESSION: release the key at full speed and let velocity decay. She
// must keep facing north, not swing round to +z. The old code read the input
// vector here, which was already (0, 0).
let facing = NORTH;
let vz = -4;
const headings: number[] = [];
for (let i = 0; i < 120; i++) {
  vz *= 0.88; // deceleration, direction unchanged
  facing = steer(facing, { x: 0, z: vz }, 14, dt);
  headings.push(facing);
}
for (const h of headings) {
  close(h, NORTH, "heading drifted while coasting to a stop");
}
// Guard the specific old symptom: never anywhere near facing +z.
assert.ok(
  Math.abs(wrapAngle(facing - facingAngle({ x: 0, z: 1 }))) > 3,
  "she snapped round to face +z on release",
);

// Turning is gradual: a single frame covers part of the angle, never all of
// it, so she pivots instead of snapping.
const afterOneFrame = steer(0, { x: 0, z: -4 }, 14, dt);
assert.ok(
  afterOneFrame > 0 && afterOneFrame < NORTH,
  `one frame should cover part of the turn, got ${afterOneFrame}`,
);

// And it goes the near way round. From just short of a half turn, heading
// back toward the camera must decrease the angle, not wrap the long way.
const nearlyHalf = Math.PI - 0.2;
const back = steer(nearlyHalf, { x: -0.01, z: 4 }, 14, dt);
assert.ok(wrapAngle(back - nearlyHalf) < 0, "took the long way round");

console.log("movement: all assertions passed");
