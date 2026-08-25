/** Run: node --test */
import assert from "node:assert/strict";

import { HOUSE_FRONT_OUTER, OUTER_HALF_WIDTH, WORLD_BOUNDS } from "./layout.ts";
import { hashRandom, isClear, scatter } from "./scatter.ts";

// Deterministic: the garden must compose identically on every load, and match
// between the server and client render.
assert.equal(hashRandom(42), hashRandom(42));
assert.notEqual(hashRandom(42), hashRandom(43));
for (let i = 0; i < 200; i++) {
  const v = hashRandom(i);
  assert.ok(v >= 0 && v < 1, `hashRandom out of range at ${i}: ${v}`);
}

// Nothing may be planted inside the cottage or across the doorstep.
assert.equal(isClear(0, HOUSE_FRONT_OUTER - 2), false, "inside the house");
assert.equal(isClear(0, 4), false, "on the path");
assert.equal(isClear(0, HOUSE_FRONT_OUTER + 1), false, "on the doorstep");
assert.equal(isClear(OUTER_HALF_WIDTH + 3, 0), true, "beside the house is fine");
assert.equal(isClear(0, 13), false, "path runs the whole way out");
assert.equal(isClear(6, 6), true, "open garden is fine");

const placements = scatter(60, 7);
assert.equal(placements.length, 60, "scatter must fill its quota");
for (const p of placements) {
  assert.ok(isClear(p.x, p.z), `placed on the house or path: ${p.x}, ${p.z}`);
  assert.ok(
    Math.abs(p.x) <= WORLD_BOUNDS && Math.abs(p.z) <= WORLD_BOUNDS,
    "placed outside the fence",
  );
  assert.ok(p.scale > 0, "zero-scale item would be invisible");
  assert.ok(Number.isFinite(p.rotation));
}

// Same seed, same garden. Different seed, different garden.
assert.deepEqual(scatter(20, 7), scatter(20, 7));
assert.notDeepEqual(scatter(20, 7), scatter(20, 99));

console.log("scatter: all assertions passed");
