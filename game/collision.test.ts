/** Run: node game/collision.test.ts */
import assert from "node:assert/strict";

import {
  clearCameraDistance,
  distanceToBoxSq,
  insideBox,
  resolve,
  resolveBox,
  type Box,
} from "./collision.ts";

const wall: Box = { x: 0, z: 0, hx: 2, hz: 0.5 };
const R = 0.4;

// Well clear of the wall: untouched.
const clear = { x: 0, z: 5 };
assert.deepEqual(resolveBox(clear, R, wall), clear);

// Approaching from +z gets pushed back to exactly touching, not teleported.
const pushed = resolveBox({ x: 0, z: 0.6 }, R, wall);
assert.equal(pushed.z, 0.9); // hz + radius
assert.equal(pushed.x, 0); // slides freely along the wall

// Same from -z.
assert.equal(resolveBox({ x: 0, z: -0.6 }, R, wall).z, -0.9);

// Near a short edge, the x axis is the cheaper escape.
const sideways = resolveBox({ x: 2.2, z: 0 }, R, wall);
assert.equal(sideways.x, 2.4);
assert.equal(sideways.z, 0);

// Dead centre is degenerate but must not produce NaN or flip-flop.
const centre = resolveBox({ x: 0, z: 0 }, R, wall);
assert.ok(Number.isFinite(centre.x) && Number.isFinite(centre.z));
assert.deepEqual(resolveBox({ x: 0, z: 0 }, R, wall), centre);

// An inside corner: two walls meeting. One pass can push out of A into B,
// so the second pass has to settle it outside both.
const corner: Box[] = [
  { x: 0, z: 0, hx: 2, hz: 0.5 },
  { x: 0, z: 0, hx: 0.5, hz: 2 },
];
const settled = resolve({ x: 0.3, z: 0.3 }, R, corner, 50);
for (const box of corner) {
  assert.ok(
    distanceToBoxSq(settled, box) >= R * R - 1e-9,
    `still inside ${JSON.stringify(box)} at ${JSON.stringify(settled)}`,
  );
}

// World bounds clamp, accounting for the player's radius.
assert.deepEqual(resolve({ x: 99, z: -99 }, R, [], 10), { x: 9.6, z: -9.6 });
assert.deepEqual(resolve({ x: 1, z: 2 }, R, [], 10), { x: 1, z: 2 });

// distanceToBoxSq is 0 inside, and measures from the face outside.
assert.equal(distanceToBoxSq({ x: 0, z: 0 }, wall), 0);
assert.equal(distanceToBoxSq({ x: 0, z: 1.5 }, wall), 1); // 1 unit past hz=0.5

// --- camera pull-in ---------------------------------------------------------
assert.equal(insideBox({ x: 0, z: 0 }, wall), true);
assert.equal(insideBox({ x: 0, z: 1 }, wall), false);
assert.equal(insideBox({ x: 0, z: 1 }, wall, 0.6), true, "padding grows the box");

// Nothing in the way: the camera gets its full distance.
assert.equal(clearCameraDistance({ x: 0, z: 5 }, { x: 0, z: 12 }, 7, []), 7);

// A wall between player and camera pulls the camera in front of it. This is
// the case that matters: standing inside the house, the camera would otherwise
// sit outside and frame the front wall.
const blocked = clearCameraDistance({ x: 0, z: -2 }, { x: 0, z: 5 }, 7, [wall]);
assert.ok(blocked < 2, `camera should stop before the wall, got ${blocked}`);
assert.ok(blocked >= 0, "distance is never negative");

// Looking away from the wall is unobstructed.
assert.equal(clearCameraDistance({ x: 0, z: 2 }, { x: 0, z: 9 }, 7, [wall]), 7);

// A wall beyond the camera's reach does not shorten anything.
const farWall: Box = { x: 0, z: 40, hx: 2, hz: 0.5 };
assert.equal(clearCameraDistance({ x: 0, z: 0 }, { x: 0, z: 10 }, 7, [farWall]), 7);

// Degenerate input must not divide by zero.
assert.equal(clearCameraDistance({ x: 1, z: 1 }, { x: 1, z: 1 }, 7, [wall]), 7);

console.log("collision: all assertions passed");
