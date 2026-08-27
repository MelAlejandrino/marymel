/** Run: node --test */
import assert from "node:assert/strict";

import { TERRAIN_RADIUS, TERRAIN_SEGMENTS, ringRadii, terrainHeight } from "./terrain.ts";
import { buildTerrainGeometry } from "./terrainMesh.ts";

const geometry = buildTerrainGeometry();
const position = geometry.getAttribute("position");
const normal = geometry.getAttribute("normal");
const color = geometry.getAttribute("color");
const index = geometry.getIndex();

assert.ok(index, "an unindexed terrain would be three times the memory");

const radii = ringRadii();
const columns = TERRAIN_SEGMENTS + 1;

// --- the buffers are the right shape ----------------------------------------

assert.equal(position.count, radii.length * columns);
assert.equal(normal.count, position.count);
assert.equal(color.count, position.count);
// Two triangles per quad, minus the middle ring, which is a fan.
assert.equal(index.count / 3, (radii.length - 2) * TERRAIN_SEGMENTS * 2 + TERRAIN_SEGMENTS);

for (let i = 0; i < position.count; i++) {
  for (const [name, attribute] of [
    ["position", position],
    ["normal", normal],
    ["color", color],
  ] as const) {
    for (const v of [attribute.getX(i), attribute.getY(i), attribute.getZ(i)]) {
      assert.ok(Number.isFinite(v), `${name} ${i} is not a number`);
    }
  }
  // Colours are linear-light values from the palette, so they belong in 0..1.
  for (const c of [color.getX(i), color.getY(i), color.getZ(i)]) {
    assert.ok(c >= 0 && c <= 1, `colour out of range at ${i}: ${c}`);
  }
  assert.ok(
    Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-5,
    `normal ${i} is not a unit vector`,
  );
  // Every normal faces the sky. One facing down would light a hillside black.
  assert.ok(normal.getY(i) > 0.4, `normal ${i} tips ${normal.getY(i)} — that is a cliff`);
  // The vertex sits on the field, not near it. Compared loosely because the
  // buffer is float32 and the field is not: at 185 out, a float32 x is already
  // a hundredth of a millimetre off the number the field was asked about.
  assert.ok(
    Math.abs(position.getY(i) - terrainHeight(position.getX(i), position.getZ(i))) < 1e-3,
    `vertex ${i} floats off its own height field`,
  );
}

// --- it closes -------------------------------------------------------------
// The ring's last column is a copy of its first. If the two are computed from
// angles that differ by a float, a hairline of sky shows through the horizon.

for (let ring = 0; ring < radii.length; ring++) {
  const first = ring * columns;
  const last = first + TERRAIN_SEGMENTS;
  for (const attribute of [position, normal, color]) {
    assert.equal(attribute.getX(first), attribute.getX(last), `seam split on ring ${ring}`);
    assert.equal(attribute.getY(first), attribute.getY(last), `seam split on ring ${ring}`);
    assert.equal(attribute.getZ(first), attribute.getZ(last), `seam split on ring ${ring}`);
  }
}

// The middle ring is one point repeated, so the fan has somewhere to start.
// (`Math.abs`, because half of those points come out as a signed zero.)
for (let c = 0; c < columns; c++) {
  assert.equal(Math.abs(position.getX(c)), 0);
  assert.equal(Math.abs(position.getZ(c)), 0);
}

// --- it faces up ------------------------------------------------------------
// Wound the wrong way, a triangle is invisible from above and the ground has
// holes in it that only show from one side of the garden.

let smallest = Infinity;
for (let t = 0; t < index.count; t += 3) {
  const [ia, ib, ic] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
  assert.ok(ia < position.count && ib < position.count && ic < position.count, "index out of range");

  const ax = position.getX(ia);
  const ay = position.getY(ia);
  const az = position.getZ(ia);
  const ux = position.getX(ib) - ax;
  const uy = position.getY(ib) - ay;
  const uz = position.getZ(ib) - az;
  const vx = position.getX(ic) - ax;
  const vy = position.getY(ic) - ay;
  const vz = position.getZ(ic) - az;
  // Cross product's y component: positive means counter-clockwise seen from
  // above, which is what three's default front face wants.
  const up = uz * vx - ux * vz;
  assert.ok(up > 0, `triangle ${t / 3} faces down or is degenerate (${up})`);

  const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  smallest = Math.min(smallest, area);
}
assert.ok(smallest > 1e-4, `a degenerate triangle of area ${smallest}`);

// --- and it covers the world ------------------------------------------------

const sphere = geometry.boundingSphere;
assert.ok(sphere, "no bounding sphere means it can never be culled");
assert.ok(sphere.radius >= TERRAIN_RADIUS, "the mesh does not reach the edge of the field");

// Under 65k vertices, so `Uint16BufferAttribute` is safe. Get this wrong and the
// indices wrap silently and the far rings stitch themselves to the middle.
assert.ok(position.count < 65536, `${position.count} vertices will not index in 16 bits`);
assert.equal(index.array.constructor, Uint16Array);

console.log(
  `terrainMesh: ${position.count} vertices, ${index.count / 3} triangles, ` +
    `${radii.length} rings out to ${TERRAIN_RADIUS} — all assertions passed`,
);
