/** Run: node --test */
import assert from "node:assert/strict";

import {
  BOUNDS,
  CASE,
  CHUTE,
  clawLowestY,
  GLASS_TOP,
  GRAB_Y,
  heldCapsuleY,
  HOLE,
  CHUTE_VOID,
  clawWidth,
  fingertipRadius,
  inChuteVoid,
  HUB,
  overHole,
  PLAY,
  PRONG,
  PRONG_REACH,
  RAIL_Y,
} from "./geometry.ts";
import { capsuleLayout } from "./mechanics.ts";

// --- the claw fits the cabinet ---------------------------------------------
// The stopping height is derived from the finger length, so the fingertips
// graze the floor by construction. Assert it anyway: it is the invariant the
// whole arrangement exists to guarantee.
let deepest = Infinity;
let deepestSplay = 0;
for (let i = 0; i <= 60; i++) {
  const splay = PRONG.splayShut + (PRONG.splayOpen - PRONG.splayShut) * (i / 60);
  const tip = clawLowestY(GRAB_Y, splay);
  if (tip < deepest) {
    deepest = tip;
    deepestSplay = splay;
  }
}
assert.ok(
  deepest >= PLAY.floorY - 1e-9,
  `fingers dip to ${deepest.toFixed(4)} at splay ${deepestSplay.toFixed(2)}, ` +
    `below the floor at ${PLAY.floorY}`,
);
assert.ok(
  deepest < PLAY.floorY + 0.03,
  "the fingers stop short of the floor and would look like they missed",
);

// It has to look like a claw. Stubby fingers on a fat hub read as a blob, which
// is exactly what happened when the reach was clamped to the capsule size.
assert.ok(
  PRONG_REACH > HUB.radiusBottom * 2.5,
  `fingers are ${(PRONG_REACH / HUB.radiusBottom).toFixed(1)}x the hub radius — too stubby to read as a claw`,
);

// THE REGRESSION: the fingers must open OUTWARD. A positive rotation about X
// swings a hanging finger *inward*, so the transform has to negate the splay —
// without that the claw sat with all three fingers collapsed through its own
// middle when open, and standing straight when shut. Exactly backwards.
const openWidth = clawWidth(PRONG.splayOpen);
const shutWidth = clawWidth(PRONG.splayShut);
assert.ok(
  openWidth > shutWidth,
  `open (${openWidth.toFixed(3)}) must be wider than shut (${shutWidth.toFixed(3)})`,
);
assert.ok(
  fingertipRadius(PRONG.splayOpen) > fingertipRadius(PRONG.splayShut),
  "the fingertips must move inward as the claw closes, not outward",
);
// Open, the tips are outside the hub axis; shut, they have met underneath.
assert.ok(fingertipRadius(PRONG.splayOpen) > 0, "the open claw's tips point inward");
assert.ok(fingertipRadius(PRONG.splayShut) < 0.02, "the shut claw's tips never meet");

// Wide enough open to go around a capsule rather than pinch at it.
assert.ok(
  openWidth > PLAY.capsuleR * 2 * 2,
  `the open claw is only ${(openWidth / (PLAY.capsuleR * 2)).toFixed(2)}x a capsule — it reads as tweezers`,
);
// And it closes to something smaller than a capsule, so the grip looks like a grip.
assert.ok(shutWidth < openWidth * 0.65, "closing barely narrows the claw");

// The width changes smoothly across the sweep — no snap, no reversal.
let previous = shutWidth;
for (let i = 1; i <= 30; i++) {
  const splay = PRONG.splayShut + (PRONG.splayOpen - PRONG.splayShut) * (i / 30);
  const width = clawWidth(splay);
  assert.ok(width >= previous - 1e-9, `width reversed at splay ${splay.toFixed(2)}`);
  previous = width;
}

// And the fingers must actually go *around* a capsule: the hub stops above the
// top of one, so it sits inside the cage rather than being poked at from above.
assert.ok(
  GRAB_Y > PLAY.floorY + PLAY.capsuleR * 2,
  "the hub stops at or below the top of a capsule — the fingers cannot enclose it",
);

// The parked claw hangs clear of the pile it is above.
assert.ok(
  clawLowestY(PLAY.parkY, PRONG.splayOpen) > PLAY.floorY + PLAY.capsuleR * 2,
  "the parked claw hangs down among the prizes",
);
// ...and the whole travel fits between the floor and the rail.
assert.ok(PRONG_REACH < PLAY.parkY - PLAY.floorY, "the fingers are longer than the cabinet");

// --- a held capsule --------------------------------------------------------
// It must not move at the instant it is grabbed: a resting capsule's centre and
// a held capsule's centre are the same height when the hub is at GRAB_Y.
assert.ok(
  Math.abs(heldCapsuleY(GRAB_Y) - (PLAY.floorY + PLAY.capsuleR)) < 1e-9,
  "the capsule would jump the moment it is grabbed",
);
// Lifted to the top it stays inside the glass.
assert.ok(
  heldCapsuleY(PLAY.parkY) + PLAY.capsuleR < GLASS_TOP,
  "a lifted capsule pokes through the roof",
);
// And it is carried above the floor the whole way, never dragged through it.
assert.ok(heldCapsuleY(GRAB_Y) - PLAY.capsuleR >= PLAY.floorY - 1e-9);

// --- the chute -------------------------------------------------------------
// The claw has to be able to reach the hole, and the hole has to be under it.
assert.ok(Math.abs(CHUTE.x) <= BOUNDS.x, "the claw cannot reach the chute in x");
assert.ok(Math.abs(CHUTE.z) <= BOUNDS.z, "the claw cannot reach the chute in z");
assert.ok(
  overHole(CHUTE.x, CHUTE.z),
  "the chute is not over the hole — the prize would land on solid floor",
);
// A whole capsule has to fit through, not just its centre.
for (const [dx, dz] of [
  [PLAY.capsuleR, 0],
  [-PLAY.capsuleR, 0],
  [0, PLAY.capsuleR],
  [0, -PLAY.capsuleR],
]) {
  assert.ok(
    overHole(CHUTE.x + dx, CHUTE.z + dz),
    `the hole is too small: the capsule's edge at ${dx},${dz} is over the floor`,
  );
}

// --- the shaft it falls down -----------------------------------------------
// The base cabinet used to be one solid box, so a capsule falling to the chute
// landed inside it and simply disappeared. There has to be a real void.
assert.ok(
  CHUTE_VOID.maxX === HOLE.maxX,
  "the shaft and the hole in the floor must line up in x",
);
assert.ok(
  CHUTE_VOID.minZ === HOLE.minZ,
  "the shaft and the hole in the floor must line up in z",
);
assert.ok(CHUTE_VOID.topY >= PLAY.floorY - 1e-9, "the shaft does not reach the floor");
assert.ok(
  Math.abs(CHUTE_VOID.trayTopY + PLAY.capsuleR - PLAY.chuteFloorY) < 1e-9,
  "a capsule resting on the tray would not sit at chuteFloorY",
);
assert.ok(CHUTE_VOID.trayTopY > 0, "the tray is below the bottom of the cabinet");

// Where it lands has to be inside the shaft, not in solid cabinet.
assert.ok(
  inChuteVoid(CHUTE.x, PLAY.chuteFloorY, CHUTE.z),
  "the landing point is not inside the shaft — the prize would vanish",
);
// And the whole fall, from release to rest, stays in the shaft once it is past
// the floor. (Above the floor it is still inside the glass, which is fine.)
for (let y = PLAY.floorY; y >= PLAY.chuteFloorY; y -= 0.02) {
  assert.ok(
    inChuteVoid(CHUTE.x, y, CHUTE.z),
    `the prize passes through solid cabinet at y=${y.toFixed(2)}`,
  );
}
// A capsule's full width has to fit down it, not just its centre.
for (const [dx, dz] of [
  [PLAY.capsuleR, 0],
  [-PLAY.capsuleR, 0],
  [0, PLAY.capsuleR],
  [0, -PLAY.capsuleR],
]) {
  assert.ok(
    inChuteVoid(CHUTE.x + dx, PLAY.chuteFloorY, CHUTE.z + dz),
    `the shaft is too narrow: the capsule's edge at ${dx},${dz} is in solid cabinet`,
  );
}
// Nothing outside the corner is hollow.
assert.equal(inChuteVoid(0, PLAY.chuteFloorY, 0), false, "the middle is not hollow");
assert.equal(inChuteVoid(0.4, PLAY.chuteFloorY, -0.3), false);
// Below the tray is solid.
assert.equal(inChuteVoid(CHUTE.x, CHUTE_VOID.trayTopY - 0.02, CHUTE.z), false);

// It falls downward, and lands inside the cabinet rather than under the world.
assert.ok(PLAY.chuteFloorY < PLAY.floorY, "the chute is not below the floor");
assert.ok(PLAY.chuteFloorY - PLAY.capsuleR > 0, "the prize lands under the cabinet");
assert.ok(
  PLAY.floorY - PLAY.chuteFloorY > 0.2,
  "the drop is too short to read as a fall",
);

// The hole stays inside the cabinet.
assert.ok(HOLE.minX >= -CASE.width / 2 - 1e-9);
assert.ok(HOLE.maxX <= CASE.width / 2);
assert.ok(HOLE.maxZ <= CASE.depth / 2 + 1e-9);

// --- the play area fits inside the glass -----------------------------------
// The claw must not be able to drive through a wall.
assert.ok(BOUNDS.x < CASE.width / 2, "the claw can reach outside the cabinet in x");
assert.ok(BOUNDS.z < CASE.depth / 2, "the claw can reach outside the cabinet in z");
assert.ok(RAIL_Y <= GLASS_TOP, "the rail is above the glass");
assert.ok(PLAY.parkY < RAIL_Y, "the claw parks above its own rail");

// --- capsules are placed somewhere sane ------------------------------------
for (const c of capsuleLayout(8)) {
  assert.ok(
    !overHole(c.x, c.z),
    `a capsule starts over the hole at ${c.x.toFixed(2)},${c.z.toFixed(2)}`,
  );
  // And each one is inside the glass, allowing for its own size.
  assert.ok(Math.abs(c.x) + PLAY.capsuleR < CASE.width / 2);
  assert.ok(Math.abs(c.z) + PLAY.capsuleR < CASE.depth / 2);
}

console.log(
  `geometry: claw ${openWidth.toFixed(3)} wide open ` +
    `(${(openWidth / (PLAY.capsuleR * 2)).toFixed(1)}x a capsule) closing to ` +
    `${shutWidth.toFixed(3)}, fingers reach ${PRONG_REACH.toFixed(3)}, ` +
    `tips graze ${deepest.toFixed(3)} vs floor ${PLAY.floorY} — all assertions passed`,
);
