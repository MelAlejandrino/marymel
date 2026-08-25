/** Run: node game/interaction/nearest.test.ts */
import assert from "node:assert/strict";

import { findNearest, type Candidate } from "./nearest.ts";

const at = (id: string, x: number, z: number, extra?: Partial<Candidate>): Candidate => ({
  id,
  x,
  z,
  range: 2,
  enabled: true,
  ...extra,
});

const origin = { x: 0, z: 0 };

assert.equal(findNearest([], origin), null);

// Out of range is not a candidate, however close it is to being close.
assert.equal(findNearest([at("far", 5, 0)], origin)?.id, undefined);
assert.equal(findNearest([at("edge", 2, 0)], origin)?.id, "edge"); // exactly at range
assert.equal(findNearest([at("just-out", 2.001, 0)], origin), null);

// Nearest wins.
assert.equal(findNearest([at("far", 1.5, 0), at("near", 0.5, 0)], origin)?.id, "near");

// Disabled objects are skipped, so something inert never steals the prompt
// from a door she can actually open.
assert.equal(
  findNearest([at("locked", 0.1, 0, { enabled: false }), at("door", 1.5, 0)], origin)?.id,
  "door",
);
assert.equal(findNearest([at("locked", 0.1, 0, { enabled: false })], origin), null);

// Each object uses its own range, not a shared one.
assert.equal(findNearest([at("big", 4, 0, { range: 5 })], origin)?.id, "big");

// Equidistant objects resolve deterministically instead of flickering.
const tie = [at("b", 1, 0), at("a", -1, 0)];
assert.equal(findNearest(tie, origin)?.id, "a");
assert.equal(findNearest([...tie].reverse(), origin)?.id, "a");

console.log("interaction: all assertions passed");
