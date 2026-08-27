/** Run: node --test */
import assert from "node:assert/strict";

import { resolve } from "../collision.ts";
import {
  BACK_WALL,
  CHIMNEY,
  DOORSTEP,
  GABLE_WINDOW,
  LANTERNS,
  collidersFor,
  DOOR,
  FRONT_SEGMENTS,
  frontWallHoles,
  frontWallOutline,
  gableOutline,
  HOUSE,
  HOUSE_BACK_INNER,
  HOUSE_FRONT_INNER,
  HOUSE_FRONT_OUTER,
  OUTER_HALF_WIDTH,
  PLAYER_RADIUS,
  RIDGE_Y,
  ROOF,
  ROOF_RUN,
  roofHeightAt,
  roofSlabs,
  SIDE_WALLS,
  SPAWN,
  WINDOW,
  WINDOWS,
  WORLD_BOUNDS,
} from "./layout.ts";

const close = (a: number, b: number, msg: string) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} !== ${b}`);

// --- roof -------------------------------------------------------------------
// Each slab is a box rotated onto the slope. three composes a local matrix as
// T * R * S, so we reproduce that here to find where the ends actually land.
// (The first version of this scene scaled a pyramid non-uniformly and *then*
// rotated it 45°, which silently produced a skewed parallelogram.)
for (const slab of roofSlabs()) {
  const [px, py] = slab.position;
  const [length] = slab.size;
  const dx = Math.cos(slab.rotationZ) * (length / 2);
  const dy = Math.sin(slab.rotationZ) * (length / 2);

  const ends = [
    { x: px + dx, y: py + dy },
    { x: px - dx, y: py - dy },
  ];
  const ridge = ends.find((e) => Math.abs(e.x) < 1e-6);
  const eave = ends.find((e) => Math.abs(e.x) > 1e-6);

  assert.ok(ridge, `slab has no end on the ridge: ${JSON.stringify(ends)}`);
  assert.ok(eave, "slab has no end at an eave");
  close(ridge.y, RIDGE_Y, "ridge height");
  close(Math.abs(eave.x), ROOF_RUN, "eave reaches past the wall");
  close(eave.y, HOUSE.wallHeight, "eave sits on top of the wall");
}

// The two slabs lean opposite ways and meet, rather than both leaning one way.
const [left, right] = roofSlabs();
close(left.rotationZ, -right.rotationZ, "slabs mirror each other");
assert.ok(left.position[0] < 0 && right.position[0] > 0, "slabs on both sides");

// The roof genuinely overhangs the wall it covers.
assert.ok(ROOF_RUN > OUTER_HALF_WIDTH, "roof must overhang the side walls");
close(roofHeightAt(0), RIDGE_Y, "ridge is the high point");
close(roofHeightAt(ROOF_RUN), HOUSE.wallHeight, "roofline meets the eave");
// Beyond the eave the roofline stops falling rather than going underground.
close(roofHeightAt(ROOF_RUN + 5), HOUSE.wallHeight, "roofline clamps");

// --- gable ------------------------------------------------------------------
// The gable has to follow the roofline, not be a plain triangle: because the
// eaves overhang, the roofline is already above wall-top at the corner.
const outline = gableOutline();
const apex = outline.find(([x]) => x === 0);
assert.ok(apex, "gable has an apex");
close(apex[1] - 0.06, ROOF.rise, "apex meets the ridge");

for (const [x, y] of outline) {
  if (x === 0) continue;
  close(Math.abs(x), OUTER_HALF_WIDTH, "gable spans the outer wall");
  if (y === 0) continue;
  close(
    y - 0.06 + HOUSE.wallHeight,
    roofHeightAt(OUTER_HALF_WIDTH),
    "gable shoulder sits on the roofline",
  );
}
// A plain triangle would be wrong here — prove the shoulder is off the floor.
assert.ok(
  outline.some(([, y]) => y > 0.05 && y < ROOF.rise),
  "gable must have a shoulder, not go straight to the apex",
);

// --- walls ------------------------------------------------------------------
// Front segments must reach the side walls, or there is a slit at each corner.
for (const seg of FRONT_SEGMENTS) {
  close(Math.abs(seg.x) + seg.hx, OUTER_HALF_WIDTH, "front wall reaches corner");
  close(Math.abs(seg.x) - seg.hx, DOOR.halfWidth, "front wall meets doorway");
}
// Side walls must span from the front wall to the back wall with no gap.
for (const wall of SIDE_WALLS) {
  close(wall.z + wall.hz, HOUSE_FRONT_INNER, "side wall meets front wall");
  close(wall.z - wall.hz, HOUSE_BACK_INNER, "side wall meets back wall");
}
close(BACK_WALL.hx, OUTER_HALF_WIDTH, "back wall spans the full width");

// --- walkability ------------------------------------------------------------
// The player spawns outside, and can actually reach the door.
const closed = collidersFor(false);
const open = collidersFor(true);
assert.equal(open.length, closed.length - 1, "opening removes exactly the door");

const spawn = resolve({ ...SPAWN }, PLAYER_RADIUS, closed, WORLD_BOUNDS);
close(spawn.x, SPAWN.x, "spawn is not inside anything (x)");
close(spawn.z, SPAWN.z, "spawn is not inside anything (z)");

// Standing right where the prompt appears must not be inside a wall.
const atDoor = { x: DOOR.x, z: DOOR.z + 0.6 };
const settled = resolve(atDoor, PLAYER_RADIUS, closed, WORLD_BOUNDS);
close(settled.x, atDoor.x, "can stand in front of the door (x)");
assert.ok(settled.z >= atDoor.z - 1e-9, "not pushed through the front wall");

// Walking into the shut door is blocked; once open, the doorway is clear.
const pushingIn = { x: 0, z: DOOR.z + 0.1 };
assert.ok(
  resolve(pushingIn, PLAYER_RADIUS, closed, WORLD_BOUNDS).z > pushingIn.z,
  "shut door must block the doorway",
);
assert.deepEqual(
  resolve(pushingIn, PLAYER_RADIUS, open, WORLD_BOUNDS),
  pushingIn,
  "open doorway must be walkable",
);

// The doorway is wider than the player, or she gets wedged in the frame.
assert.ok(DOOR.halfWidth > PLAYER_RADIUS + 0.1, "doorway too narrow to walk through");

// Inside the house is reachable and roomy once the door is open.
const inside = resolve({ x: 0, z: HOUSE.backZ + 2 }, PLAYER_RADIUS, open, WORLD_BOUNDS);
close(inside.x, 0, "inside the house is clear (x)");
close(inside.z, HOUSE.backZ + 2, "inside the house is clear (z)");

// --- the front wall's openings ---------------------------------------------
// The wall is extruded from an outline with holes punched in it, so the window
// is a real opening you can see glass in from either side. When it was built
// from boxes instead, the pane could only ever be stuck on the outside face —
// and from the armchair you saw a curtain hanging on blank plaster.
const elevation = frontWallOutline();
for (const [x, y] of elevation) {
  close(Math.abs(x), OUTER_HALF_WIDTH, "front wall spans the full width");
  assert.ok(
    y === 0 || Math.abs(y - HOUSE.wallHeight) < 1e-9,
    `front wall corner at y ${y} is neither ground nor wall-top`,
  );
}
assert.ok(
  elevation.some(([, y]) => y === 0) && elevation.some(([, y]) => y > 0),
  "the elevation must have height",
);

const holes = frontWallHoles();
assert.equal(holes.length, WINDOWS.length + 1, "one hole per window, plus the doorway");

const bounds = (hole: Array<[number, number]>) => ({
  minX: Math.min(...hole.map(([x]) => x)),
  maxX: Math.max(...hole.map(([x]) => x)),
  minY: Math.min(...hole.map(([, y]) => y)),
  maxY: Math.max(...hole.map(([, y]) => y)),
});

// Every hole has to sit strictly inside the outline. Touching the edge is a
// degenerate case for the triangulator, not a tidy flush join, and it shows up
// as slivers in the finished wall.
for (const hole of holes) {
  const b = bounds(hole);
  assert.equal(hole.length, 4, "each opening is a rectangle");
  assert.ok(b.minX > -OUTER_HALF_WIDTH, "an opening breaks the left edge of the wall");
  assert.ok(b.maxX < OUTER_HALF_WIDTH, "an opening breaks the right edge of the wall");
  assert.ok(b.minY > 0, "an opening reaches the ground line — degenerate extrusion");
  assert.ok(b.maxY < HOUSE.wallHeight, "an opening breaks through the wall-top");
}

// ...but the doorway still has to come near enough to the ground that there is
// no step in it. The interior floor sits at y 0.02 and covers the remainder.
const doorway = holes.find((hole) => bounds(hole).minY < 0.02);
assert.ok(doorway, "the doorway must reach the floor");
const doorBounds = bounds(doorway);
close(doorBounds.maxX, DOOR.halfWidth, "the doorway hole matches the door");
close(doorBounds.minX, -DOOR.halfWidth, "the doorway hole matches the door");
assert.ok(doorBounds.maxY >= DOOR.height, "the doorway hole is shorter than the door");

// Each window's hole is exactly the pane, and clear of the doorway's.
for (const win of WINDOWS) {
  const hole = holes.find((h) => Math.abs(bounds(h).minX + WINDOW.width / 2 - win.x) < 1e-9);
  assert.ok(hole, `no opening cut for the window at x ${win.x}`);
  const b = bounds(hole);
  close(b.maxX - b.minX, WINDOW.width, "window hole is the width of the pane");
  close(b.maxY - b.minY, WINDOW.height, "window hole is the height of the pane");
  assert.ok(b.minY > 0, "a window hole reaching the ground would be a doorway");
  // Holes must not touch, or the wall between them disappears.
  assert.ok(
    b.minX > doorBounds.maxX || b.maxX < doorBounds.minX,
    "a window opening runs into the doorway",
  );
}

// --- decoration placement ---------------------------------------------------
// The complaint that started this file was things not lining up, so the
// trimmings get pinned too, not just the structure.

for (const win of WINDOWS) {
  const halfSpan = WINDOW.width / 2 + WINDOW.frame;
  // Must sit on the wall either side of the doorway, not over the opening or
  // hanging off the corner.
  assert.ok(
    Math.abs(win.x) - halfSpan > DOOR.halfWidth,
    `window at ${win.x} overlaps the doorway`,
  );
  assert.ok(
    Math.abs(win.x) + halfSpan < OUTER_HALF_WIDTH,
    `window at ${win.x} hangs off the corner`,
  );
  // And between the ground and the eaves.
  assert.ok(
    win.y + WINDOW.height / 2 + WINDOW.frame < HOUSE.wallHeight,
    "window pokes through the eaves",
  );
  assert.ok(win.y - WINDOW.height / 2 - WINDOW.sillDrop > 0, "window sill underground");
}
assert.equal(WINDOWS.length, 2);
assert.equal(WINDOWS[0].x, -WINDOWS[1].x, "windows must be symmetrical");

// The gable window has to clear the sloping roofline, not just the wall top.
assert.ok(GABLE_WINDOW.y - GABLE_WINDOW.radius > HOUSE.wallHeight, "gable window too low");
assert.ok(
  GABLE_WINDOW.y + GABLE_WINDOW.radius + GABLE_WINDOW.rim <
    roofHeightAt(GABLE_WINDOW.radius),
  "gable window breaks through the roof slope",
);

// The chimney must start under the roofline and finish above it.
const chimneyRoofline = roofHeightAt(CHIMNEY.x);
assert.ok(CHIMNEY.top > chimneyRoofline, "chimney does not clear the roof");
assert.ok(CHIMNEY.sink > 0.3, "chimney would show a gap where it meets the roof");
assert.ok(Math.abs(CHIMNEY.x) + CHIMNEY.width / 2 < ROOF_RUN, "chimney hangs off the roof");
assert.ok(
  CHIMNEY.z > HOUSE.backZ && CHIMNEY.z < HOUSE.frontZ,
  "chimney must sit over the house",
);

// Lanterns flank the door without standing on the step or in the doorway.
assert.equal(LANTERNS.length, 2);
assert.equal(LANTERNS[0], -LANTERNS[1], "lanterns must be symmetrical");
for (const x of LANTERNS) {
  assert.ok(Math.abs(x) > DOORSTEP.halfWidth, `lantern at ${x} stands on the step`);
  assert.ok(Math.abs(x) > DOOR.halfWidth, `lantern at ${x} blocks the doorway`);
  assert.ok(Math.abs(x) < OUTER_HALF_WIDTH, `lantern at ${x} floats past the wall`);
}

// The step sits against the front wall, outside it.
assert.ok(DOORSTEP.z > HOUSE_FRONT_INNER, "doorstep is inside the house");
assert.ok(
  DOORSTEP.z - DOORSTEP.depth / 2 <= HOUSE_FRONT_OUTER + 1e-9,
  "doorstep floats away from the wall",
);
assert.ok(DOORSTEP.halfWidth > DOOR.halfWidth, "doorstep narrower than the door");

console.log("layout: all assertions passed");
