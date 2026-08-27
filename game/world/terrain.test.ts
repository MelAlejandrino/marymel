/** Run: node --test */
import assert from "node:assert/strict";

import { collidersFor, PATH_STONES, TREES, WORLD_BOUNDS } from "./layout.ts";
import { BUSHES, rabbitHomes } from "./critters.ts";
import { scatter } from "./scatter.ts";
import {
  CLEARING,
  DETAIL,
  detailFade,
  gardenEdge,
  HILLS,
  hillRise,
  hills,
  noise2,
  RING_BANDS,
  ringRadii,
  riseWeight,
  rolling,
  smoothstep01,
  TERRAIN_RADIUS,
  TERRAIN_SEGMENTS,
  terrainSample,
  terrainShade,
  terrainSlope,
  terrainHeight,
} from "./terrain.ts";

// --- the clearing is flat, and that is not negotiable ------------------------
// Nothing in the world samples the ground: the player is pinned to y = 0, the
// rabbits hop from it, the fence and the path stones stand on it. Every one of
// them is inside the fence, so every one of them needs the height there to be
// *exactly* zero — not small.

for (let x = -WORLD_BOUNDS; x <= WORLD_BOUNDS; x += 0.5) {
  for (let z = -WORLD_BOUNDS; z <= WORLD_BOUNDS; z += 0.5) {
    assert.equal(terrainHeight(x, z), 0, `ground moved inside the fence at ${x}, ${z}`);
  }
}

// The corners are the far point of the garden and the reason `CLEARING` is
// derived from `gardenEdge` rather than picked: a clearing sized to the middle
// of a fence run leaves the corner posts hanging over a slope.
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    assert.equal(riseWeight(sx * WORLD_BOUNDS, sz * WORLD_BOUNDS), 0, "fence corner");
  }
}
assert.ok(CLEARING > gardenEdge(WORLD_BOUNDS, WORLD_BOUNDS), "clearing must clear the fence");

// Everything the garden plants, and everywhere she can stand, at y = 0.
for (const p of [
  ...TREES,
  ...BUSHES,
  ...scatter(230, 11),
  ...scatter(560, 29),
  ...rabbitHomes(7),
  ...PATH_STONES.map((s) => ({ x: s.x, z: s.z })),
]) {
  assert.equal(terrainHeight(p.x, p.z), 0, `planted on a slope at ${p.x}, ${p.z}`);
}

// The camera swings out behind her, so it reaches further than she does. It must
// not end up inside a hillside: everywhere it can go, the ground is far below it.
// (`followCamera` holds it at 4.2, dropping to 1.1 only when a wall pulls it in.)
const CAMERA_REACH = 6;
for (let a = 0; a < Math.PI * 2; a += Math.PI / 90) {
  const x = Math.min(WORLD_BOUNDS, Math.abs(Math.sin(a)) * WORLD_BOUNDS) * Math.sign(Math.sin(a) || 1);
  const z = Math.min(WORLD_BOUNDS, Math.abs(Math.cos(a)) * WORLD_BOUNDS) * Math.sign(Math.cos(a) || 1);
  const height = terrainHeight(x + Math.sin(a) * CAMERA_REACH, z + Math.cos(a) * CAMERA_REACH);
  assert.ok(height < 1, `ground at ${height} where the camera swings out`);
}

// --- continuous everywhere --------------------------------------------------
// A height field is only as good as its derivative: a step, a crease or a spike
// reads as a tear in the world, and the normals are taken from this field, so a
// kink in it becomes a black line across a hillside.

let steepest = 0;
let steepestAt = { x: 0, z: 0 };
let highest = -Infinity;
let lowest = Infinity;
for (let x = -TERRAIN_RADIUS; x <= TERRAIN_RADIUS; x += 1.5) {
  for (let z = -TERRAIN_RADIUS; z <= TERRAIN_RADIUS; z += 1.5) {
    if (Math.hypot(x, z) > TERRAIN_RADIUS) continue;
    const h = terrainHeight(x, z);
    assert.ok(Number.isFinite(h), `height is not a number at ${x}, ${z}`);
    highest = Math.max(highest, h);
    lowest = Math.min(lowest, h);
    const slope = terrainSlope(x, z);
    if (slope > steepest) {
      steepest = slope;
      steepestAt = { x, z };
    }
  }
}

// 45° is the limit for ground that has to read as grass rather than as cliff —
// and `terrainShade` starts showing stone at 31°, so anything steeper is at
// least honest about it.
assert.ok(steepest < 1, `${Math.round((Math.atan(steepest) * 180) / Math.PI)}° slope at ${steepestAt.x}, ${steepestAt.z}`);

// The whole landscape is bounded by its tallest hill plus the roll of the open
// ground. This is what `hills()` averaging rather than summing buys, and it is
// the assertion that keeps the frame safe: at the far corner of the garden the
// massif is only ~40 away, and the follow camera can only see ~12° above the
// horizontal (78° tall, pitched 27° down), so a hill that grows quietly past
// about 22 stops having a summit on screen at all.
const tallest = Math.max(...HILLS.map((h) => h.height));
assert.ok(highest < tallest + 6, `ground reached ${highest.toFixed(1)} against a tallest hill of ${tallest}`);
assert.ok(highest > 18, `nothing in the landscape is prominent: ${highest.toFixed(1)}`);
assert.ok(lowest < -0.5, "no hollows anywhere: the ground only ever rises");
assert.ok(lowest > -8, `a pit ${lowest.toFixed(1)} deep is a hole, not a valley`);

// Walking a line through the middle of the world, no single step may jump.
let biggestStep = 0;
for (const [ax, az, bx, bz] of [
  [0, TERRAIN_RADIUS, 0, -TERRAIN_RADIUS],
  [-TERRAIN_RADIUS, 0, TERRAIN_RADIUS, 0],
  [-130, -130, 130, 130],
  [-130, 130, 130, -130],
]) {
  const steps = 4000;
  let previous = terrainHeight(ax, az);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const h = terrainHeight(ax + (bx - ax) * t, az + (bz - az) * t);
    biggestStep = Math.max(biggestStep, Math.abs(h - previous));
    previous = h;
  }
}
// The samples are ~0.07 apart, so this is the slope again, seen along a line.
assert.ok(biggestStep < 0.08, `the ground steps by ${biggestStep.toFixed(3)} between samples`);

// --- the hills are hills ----------------------------------------------------

for (const hill of HILLS) {
  // Each one is a smooth dome: full height at the summit, nothing at the foot,
  // and level at both ends so it meets the ground without a crease.
  assert.ok(hillRise(hill, hill.x, hill.z) > hill.height * 0.99, "summit");
  const far = hill.radius * hill.stretch * 2 + 40;
  assert.equal(hillRise(hill, hill.x + far, hill.z), 0, "past the foot");
  assert.equal(hillRise(hill, hill.x, hill.z + far), 0, "past the foot");
  // Elliptical and turned, never a circle: a round hill reads as a scoop of ice
  // cream from the first glance.
  assert.ok(hill.stretch > 1.1, "a circular hill");
  assert.ok(hill.wobble > 0.15, "a hill with an undistorted foot");
}

// Blending, not stacking. Two overlapping feet may not add up.
const [a, b] = HILLS;
const between = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
assert.ok(
  hills(between.x, between.z) <= Math.max(a.height, b.height) + 1e-9,
  "the gap between two hills filled in higher than either of them",
);

// Wherever only one hill reaches, it comes through at exactly its own height —
// the blend must not shave a hill down just for being in the list.
let alone = 0;
for (let x = -TERRAIN_RADIUS; x <= TERRAIN_RADIUS && alone < 40; x += 7) {
  for (let z = -TERRAIN_RADIUS; z <= TERRAIN_RADIUS && alone < 40; z += 7) {
    const rises = HILLS.map((h) => hillRise(h, x, z)).filter((h) => h > 0);
    if (rises.length !== 1) continue;
    alone++;
    assert.ok(Math.abs(hills(x, z) - rises[0]) < 1e-9, `a lone hill was averaged at ${x}, ${z}`);
  }
}
assert.ok(alone > 10, "every hill overlaps another: nothing stands on its own");

// And nowhere may the blend exceed the tallest thing reaching that point.
for (let x = -TERRAIN_RADIUS; x <= TERRAIN_RADIUS; x += 11) {
  for (let z = -TERRAIN_RADIUS; z <= TERRAIN_RADIUS; z += 11) {
    const rises = HILLS.map((h) => hillRise(h, x, z));
    assert.ok(hills(x, z) <= Math.max(...rises) + 1e-9, `hills stacked at ${x}, ${z}`);
  }
}

// The massif is off the cottage's axis, so the roofline reads against a flank
// rather than being centred under a summit — and left of it, away from the sun
// at +x, so its lit face turns toward the camera.
const massif = HILLS[0];
assert.ok(massif.x < -25, "the main hill sits on the path's axis");
assert.ok(massif.z < -40, "the main hill is not behind the cottage");

// Something to see in every direction. Turning round in the garden must not
// find a flat quarter.
for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
  let best = 0;
  for (let r = 40; r <= TERRAIN_RADIUS - 20; r += 4) {
    best = Math.max(best, terrainHeight(Math.sin(a) * r, Math.cos(a) * r));
  }
  assert.ok(best > 6, `nothing on the horizon toward ${((a * 180) / Math.PI).toFixed(0)}°`);
}

// --- three depths, and the fog between them ---------------------------------
// The camera at the gate. Aerial perspective only reads if the layers actually
// differ in haze, so this pins one crisp layer, one hazing and one all but gone.
const GATE = { x: 0, z: 27 };
const FOG_NEAR = 48;
const FOG_FAR = 140;
const hazeAt = (d: number) => Math.min(1, Math.max(0, (d - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));

const layers = { crisp: 0, hazing: 0, gone: 0 };
for (const hill of HILLS) {
  const d = Math.hypot(hill.x - GATE.x, hill.z - GATE.z);
  const haze = hazeAt(d);
  if (haze < 0.25) layers.crisp++;
  else if (haze < 0.75) layers.hazing++;
  else layers.gone++;
}
assert.ok(layers.crisp >= 2, "no crisp layer: every hill is already in the haze");
assert.ok(layers.hazing >= 4, "no midground");
assert.ok(layers.gone >= 2, "nothing beyond the fog to say the world keeps going");

// The ground has to reach past the far plane of the fog, or its own edge shows.
// The camera can stand 6 behind her at the fence, so measure from there.
const CAMERA_LIMIT = WORLD_BOUNDS + CAMERA_REACH;
assert.ok(
  TERRAIN_RADIUS - CAMERA_LIMIT > FOG_FAR,
  `the edge of the world is ${TERRAIN_RADIUS - CAMERA_LIMIT} away and the fog closes at ${FOG_FAR}`,
);

// Nothing pokes above the treeline close in, or the hills hide the world they
// are supposed to frame.
for (let x = -40; x <= 40; x += 1) {
  for (let z = -40; z <= 40; z += 1) {
    assert.ok(terrainHeight(x, z) < 5, `${terrainHeight(x, z).toFixed(1)} tall inside the treeline`);
  }
}

// --- resolution: the mesh has to be able to hold what the field asks of it ---

const radii = ringRadii();
assert.equal(radii[0], 0, "the grid must close in the middle");
assert.equal(radii[radii.length - 1], TERRAIN_RADIUS, "the grid must reach the edge");
for (let i = 1; i < radii.length; i++) {
  assert.ok(radii[i] > radii[i - 1], "rings must go outward");
}

// Detail below about five samples per wavelength stops reading as uneven ground
// and starts reading as noise, so the field gives its detail up at exactly the
// radius the mesh stops being able to carry it.
let from = 0;
for (const [reach, step] of RING_BANDS) {
  // Except the middle band, which is inside the clearing: flat by construction,
  // nothing to resolve, and two rings wide for exactly that reason.
  const flat = reach <= CLEARING;
  if (!flat && step * 5 > DETAIL) {
    assert.equal(
      detailFade(from + step),
      0,
      `the band out to ${reach} steps ${step}, too coarse for a ${DETAIL} wavelength`,
    );
  }
  from = reach;
}
assert.ok(detailFade(30) > 0.9, "the near ground gave up its detail early");
assert.ok(detailFade(TERRAIN_RADIUS) === 0, "detail is still being asked for out in the haze");

// A budget, not a measurement: this has to stay a rounding error on a low-end
// desktop next to the garden's own few thousand instanced pieces.
const triangles = (radii.length - 1) * TERRAIN_SEGMENTS * 2;
assert.ok(triangles < 12000, `${triangles} triangles of ground`);
assert.ok(radii.length * (TERRAIN_SEGMENTS + 1) < 65536, "vertices must index in 16 bits");

// --- colour -----------------------------------------------------------------

for (const [height, slope, radius, enclosure] of [
  [0, 0, 0, 0],
  [0, 0, 20, 0],
  [12, 0.3, 60, 0.2],
  [22, 1.2, 130, 1],
  [-4, 0.1, 90, 0.8],
] as const) {
  const shade = terrainShade(height, slope, radius, enclosure);
  for (const [name, weight] of Object.entries(shade)) {
    assert.ok(weight >= 0 && weight <= 1, `${name} weight out of range: ${weight}`);
  }
}

// The lawn keeps exactly the green it had as a plane: no tint, no haze, flat up.
const lawn = terrainSample(0, 10);
assert.deepEqual(lawn.shade, { dry: 0, rock: 0, hollow: 0, haze: 0 });
assert.deepEqual(lawn.normal, [0, 1, 0]);
assert.equal(lawn.height, 0);

// Further away is hazier; higher is drier; steeper is stonier.
assert.ok(
  terrainShade(0, 0, 130, 0).haze > terrainShade(0, 0, 60, 0).haze,
  "the far ground is no hazier than the near ground",
);
assert.ok(terrainShade(20, 0, 0, 0).dry > terrainShade(4, 0, 0, 0).dry);
assert.ok(terrainShade(0, 1.2, 0, 0).rock > terrainShade(0, 0.2, 0, 0).rock);
assert.equal(terrainShade(0, 0.2, 0, 0).rock, 0, "level ground showing stone");

// A summit is never in shadow and a fold always is.
const summit = terrainSample(massif.x, massif.z);
assert.ok(summit.shade.hollow < 0.2, "the summit came out as a hollow");
assert.ok(summit.shade.dry > 0.2, "the summit is not catching the sun");

// --- determinism ------------------------------------------------------------
// Same landscape on every load, and the same one on the server as in the
// browser. `Math.random()` is not allowed anywhere in this world.
assert.equal(noise2(3.7, -8.2), noise2(3.7, -8.2));
assert.equal(terrainHeight(-44, -62), terrainHeight(-44, -62));
assert.deepEqual(terrainSample(30, -70), terrainSample(30, -70));
for (let i = 0; i < 300; i++) {
  const v = noise2(i * 0.7, -i * 1.3);
  assert.ok(v >= 0 && v <= 1, `noise out of range: ${v}`);
}
assert.equal(smoothstep01(-1), 0);
assert.equal(smoothstep01(2), 1);
assert.ok(Math.abs(smoothstep01(0.5) - 0.5) < 1e-12);

// The open ground rolls both ways about zero, so the meadow has dips in it and
// not just swells.
let up = 0;
let down = 0;
for (let i = 0; i < 400; i++) {
  const h = rolling(Math.sin(i) * 120, Math.cos(i * 1.7) * 120);
  if (h > 0.5) up++;
  if (h < -0.5) down++;
}
assert.ok(up > 40 && down > 40, `open ground is one-sided: ${up} up, ${down} down`);

// Colliders are unchanged: the terrain is scenery, and nothing about it can be
// walked into.
assert.equal(collidersFor(true).length, collidersFor(false).length - 1);

console.log(
  `terrain: ${HILLS.length} hills, ${triangles} triangles, ` +
    `${highest.toFixed(1)} at the highest, ${Math.round((Math.atan(steepest) * 180) / Math.PI)}° at the steepest — all assertions passed`,
);
