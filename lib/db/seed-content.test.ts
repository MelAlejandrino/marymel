/** Run: node --test */
import assert from "node:assert/strict";

import { resolve } from "../../game/collision.ts";
import {
  collidersFor,
  PLAYER_RADIUS,
  WORLD_BOUNDS,
} from "../../game/world/layout.ts";
import { countFindable, SEED_SPOTS } from "./seed-content.ts";

/** How close she must get, matching the ranges in game/world/spots. */
const RANGE: Record<string, number> = {
  ARCADE: 2.4,
  FRAME: 2.2,
  LETTER: 1.9,
  KEEPSAKE: 1.8,
};

const colliders = collidersFor(true); // the door can be opened, so assume it is

/** Somewhere she can actually stand: resolve() leaves a clear point alone. */
function isStandable(x: number, z: number): boolean {
  const settled = resolve({ x, z }, PLAYER_RADIUS, colliders, WORLD_BOUNDS);
  return Math.abs(settled.x - x) < 1e-6 && Math.abs(settled.z - z) < 1e-6;
}

assert.ok(SEED_SPOTS.length > 0, "the world needs something in it");

for (const spot of SEED_SPOTS) {
  const where = `${spot.kind} "${spot.title}" at (${spot.x}, ${spot.z})`;

  // Inside the fence, with room for the model.
  assert.ok(
    Math.abs(spot.x) < WORLD_BOUNDS - 1 && Math.abs(spot.z) < WORLD_BOUNDS - 1,
    `${where} is outside the fence`,
  );

  // She has to be able to reach it. A frame can sit flat against a wall, so
  // the spot itself need not be standable — but somewhere within range must be.
  const range = RANGE[spot.kind];
  assert.ok(range, `${spot.kind} has no interaction range`);

  const reachable = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    // Just inside the range, so the prompt is already showing.
    const r = range - 0.35;
    return { x: spot.x + Math.cos(a) * r, z: spot.z + Math.sin(a) * r };
  }).some((p) => isStandable(p.x, p.z));

  assert.ok(reachable, `${where} cannot be reached — walled in`);

  // Content: an arcade has prizes, everything else has a memory.
  if (spot.kind === "ARCADE") {
    assert.ok(spot.prizes?.length, `${where} is a machine with no prizes`);
    assert.ok(!spot.memory, `${where} should hold prizes, not a memory`);
  } else {
    assert.ok(spot.memory, `${where} reveals nothing`);
    assert.ok(!spot.prizes, `only arcades hold prizes: ${where}`);
  }

  assert.ok(spot.title === spot.title.toLowerCase(), `${where}: titles read inside a
    sentence ("Read the note on the step"), so they stay lowercase`);
}

// Nothing may sit on top of anything else.
for (let i = 0; i < SEED_SPOTS.length; i++) {
  for (let j = i + 1; j < SEED_SPOTS.length; j++) {
    const a = SEED_SPOTS[i];
    const b = SEED_SPOTS[j];
    const gap = Math.hypot(a.x - b.x, a.z - b.z);
    assert.ok(
      gap > 1.2,
      `"${a.title}" and "${b.title}" are ${gap.toFixed(2)} apart — they overlap`,
    );
  }
}

// Ids are what the interaction registry keys on, so titles must be distinct
// enough to tell apart in a prompt.
const titles = SEED_SPOTS.map((s) => s.title);
assert.equal(new Set(titles).size, titles.length, "two spots share a title");

// The counter the collection panel shows.
assert.equal(countFindable(), 16);
assert.equal(countFindable([]), 0);

console.log(`seed-content: ${SEED_SPOTS.length} spots, ${countFindable()} things to find`);
