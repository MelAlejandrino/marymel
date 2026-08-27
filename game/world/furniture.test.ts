/** Run: node --test */
import assert from "node:assert/strict";

import { resolve } from "../collision.ts";
import { footprint, FURNITURE, RUGS, SCONCES } from "./furniture.ts";
import {
  collidersFor,
  DOOR,
  HEARTH_COLLIDER,
  HOUSE,
  HOUSE_BACK_INNER,
  HOUSE_FRONT_INNER,
  PLAYER_RADIUS,
  WORLD_BOUNDS,
} from "./layout.ts";

const close = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} !== ${b}`);

const INNER_HALF_WIDTH = HOUSE.halfWidth - HOUSE.wallThickness / 2;

// --- footprint --------------------------------------------------------------
// The room is furnished at right angles, but the armchair is turned to face
// the fire — so the rotated bounding box has to be right, not just for the
// square cases.
const oblong = { kind: "sofa", x: 0, z: 0, rotation: 0, hx: 1, hz: 0.25 } as const;
close(footprint(oblong).hx, 1, "unrotated keeps its width");
close(footprint(oblong).hz, 0.25, "unrotated keeps its depth");

const turned = footprint({ ...oblong, rotation: Math.PI / 2 });
close(turned.hx, 0.25, "a quarter turn swaps width for depth");
close(turned.hz, 1, "a quarter turn swaps depth for width");

close(
  footprint({ ...oblong, rotation: -Math.PI / 2 }).hx,
  0.25,
  "turning the other way is the same box",
);
close(footprint({ ...oblong, rotation: Math.PI }).hx, 1, "a half turn is the same box");

// At 45° the box has to grow, or you walk through the corner of the piece.
const diagonal = footprint({ ...oblong, rotation: Math.PI / 4 });
assert.ok(diagonal.hx > oblong.hx * 0.7, "a diagonal piece claims too little floor");
assert.ok(
  diagonal.hx <= oblong.hx + oblong.hz + 1e-9,
  "a diagonal piece claims more than its own diagonal",
);

// --- placement --------------------------------------------------------------
const boxes = FURNITURE.map((item) => ({ item, box: footprint(item) }));

for (const { item, box } of boxes) {
  const where = `${item.kind} at (${item.x}, ${item.z})`;

  assert.ok(
    Math.abs(box.x) + box.hx <= INNER_HALF_WIDTH + 1e-9,
    `${where} is pushed through a side wall`,
  );
  assert.ok(box.z - box.hz >= HOUSE_BACK_INNER - 1e-9, `${where} is through the back wall`);
  assert.ok(box.z + box.hz <= HOUSE_FRONT_INNER + 1e-9, `${where} is out the front wall`);

  // Nothing may stand in the fire.
  const gapX = Math.abs(box.x - HEARTH_COLLIDER.x) - (box.hx + HEARTH_COLLIDER.hx);
  const gapZ = Math.abs(box.z - HEARTH_COLLIDER.z) - (box.hz + HEARTH_COLLIDER.hz);
  assert.ok(gapX > 0 || gapZ > 0, `${where} overlaps the hearth`);
}

// Two pieces may not occupy the same floor.
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i];
    const b = boxes[j];
    const gapX = Math.abs(a.box.x - b.box.x) - (a.box.hx + b.box.hx);
    const gapZ = Math.abs(a.box.z - b.box.z) - (a.box.hz + b.box.hz);
    assert.ok(
      gapX > 0 || gapZ > 0,
      `${a.item.kind} and ${b.item.kind} are standing in each other`,
    );
  }
}

// --- you can still get around ----------------------------------------------
// A furnished room that cannot be walked through is worse than an empty one.
const colliders = collidersFor(true);
const standable = (x: number, z: number) => {
  const settled = resolve({ x, z }, PLAYER_RADIUS, colliders, WORLD_BOUNDS);
  return Math.abs(settled.x - x) < 1e-6 && Math.abs(settled.z - z) < 1e-6;
};

// Straight in through the door and down the middle of the room.
for (let z = DOOR.z; z > HOUSE_BACK_INNER + 0.6; z -= 0.25) {
  assert.ok(standable(DOOR.x, z), `the way in is blocked at z ${z.toFixed(2)}`);
}

// And across it, at the open middle where the rug is.
for (let x = -2.4; x <= 2.4; x += 0.2) {
  assert.ok(standable(x, -9), `the middle of the room is blocked at x ${x.toFixed(2)}`);
}

// --- trimmings --------------------------------------------------------------
for (const rug of RUGS) {
  assert.ok(
    Math.abs(rug.x) + rug.radius <= INNER_HALF_WIDTH + 1e-9,
    `the rug at (${rug.x}, ${rug.z}) runs up the wall`,
  );
  assert.ok(
    rug.z - rug.radius >= HOUSE_BACK_INNER && rug.z + rug.radius <= HOUSE_FRONT_INNER,
    `the rug at (${rug.x}, ${rug.z}) runs out of the room`,
  );
}

for (const sconce of SCONCES) {
  assert.ok(
    Math.abs(Math.abs(sconce.x) - INNER_HALF_WIDTH) < 0.12,
    `the sconce at x ${sconce.x} is not on a wall`,
  );
  assert.ok(
    sconce.z > HOUSE_BACK_INNER && sconce.z < HOUSE_FRONT_INNER,
    `the sconce at z ${sconce.z} is outside the room`,
  );
}

console.log(
  `furniture: ${FURNITURE.length} pieces, ${RUGS.length} rugs, ${SCONCES.length} sconces — all assertions passed`,
);
