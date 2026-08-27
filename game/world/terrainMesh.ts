import { BufferGeometry, Color, Float32BufferAttribute, Uint16BufferAttribute } from "three";

import { PALETTE } from "./palette.ts";
import { ringRadii, TERRAIN_SEGMENTS, terrainSample, type Shade } from "./terrain.ts";

/**
 * The terrain as a mesh: one geometry, built once at load.
 *
 * Split out of `Terrain.tsx` for the same reason the claw's `geometry.ts` is —
 * so `terrainMesh.test.ts` can build the thing in node and check that it is
 * actually closed, wound the right way up and free of holes. A mesh this size
 * with a hairline crack in it, or one triangle facing down, is not something you
 * find by looking at a screenshot of the middle of the world.
 *
 * Two decisions worth knowing before changing anything:
 *
 * - **This is the lawn too.** The garden used to stand on its own 96 × 96 plane;
 *   this replaces it, because two surfaces at y = 0 fight over every pixel and
 *   the plane's straight edge cut a line through the hills behind it. Inside the
 *   fence the field is flat and untinted, so the lawn is exactly the green it
 *   always was, and the meadow beyond it is the same surface — there is no seam
 *   at the fence because there is no join.
 * - **The grid is polar.** Rings, not rows. A square grid has corners, and a
 *   corner 185 out is 260 out along the diagonal: either the edge of the world
 *   shows or most of the vertices go on keeping it hidden. Rings also make the
 *   level of detail free — the spacing widens with distance, and the camera
 *   cannot leave the middle.
 */

/** Mix one vertex's colour from the palette by weight. */
function tint(out: Color, shade: Shade, parts: Record<string, Color>) {
  out.copy(parts.base);
  out.lerp(parts.hollow, shade.hollow);
  out.lerp(parts.crest, shade.dry);
  out.lerp(parts.scree, shade.rock);
  // Haze last: it is the air in front of the ground, so it goes over whatever
  // the ground turned out to be.
  out.lerp(parts.haze, shade.haze);
}

export function buildTerrainGeometry(): BufferGeometry {
  const radii = ringRadii();
  const spokes = TERRAIN_SEGMENTS;
  /** One extra column, holding a second copy of the first: a ring has to close. */
  const columns = spokes + 1;
  const count = radii.length * columns;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const parts = {
    // The lawn's own green, so the two ends of one surface match exactly.
    base: new Color(PALETTE.grass),
    hollow: new Color(PALETTE.hill.hollow),
    crest: new Color(PALETTE.hill.crest),
    scree: new Color(PALETTE.hill.scree),
    haze: new Color(PALETTE.hill.haze),
  };
  const colour = new Color();

  // `c % spokes` on the closing column, so the seam's two copies come out of the
  // *same* angle. Taking it from `c / spokes` instead leaves them a float apart,
  // which is all a hairline crack at the horizon needs.
  const cos: number[] = [];
  const sin: number[] = [];
  for (let c = 0; c < columns; c++) {
    const angle = ((c % spokes) / spokes) * Math.PI * 2;
    cos.push(Math.cos(angle));
    sin.push(Math.sin(angle));
  }

  let v = 0;
  for (const radius of radii) {
    for (let c = 0; c < columns; c++, v++) {
      const x = cos[c] * radius;
      const z = sin[c] * radius;
      const { height, normal, shade } = terrainSample(x, z);

      positions[v * 3] = x;
      positions[v * 3 + 1] = height;
      positions[v * 3 + 2] = z;

      normals[v * 3] = normal[0];
      normals[v * 3 + 1] = normal[1];
      normals[v * 3 + 2] = normal[2];

      tint(colour, shade, parts);
      colors[v * 3] = colour.r;
      colors[v * 3 + 1] = colour.g;
      colors[v * 3 + 2] = colour.b;
    }
  }

  // Wound counter-clockwise seen from above, so the ground faces the sky.
  const index: number[] = [];
  for (let ring = 0; ring < radii.length - 1; ring++) {
    for (let c = 0; c < spokes; c++) {
      const inner = ring * columns + c;
      const outer = inner + columns;
      // The middle "ring" is one point repeated, so its quads are triangles:
      // emitting both halves there leaves a fan of degenerate ones under her.
      if (ring > 0) index.push(inner, inner + 1, outer);
      index.push(inner + 1, outer + 1, outer);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  // Set outright rather than computed: the normals are the height field's own
  // gradient, not the triangles' — see `terrainNormal`.
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  // Well under 65k vertices, so the indices fit in half the memory.
  geometry.setIndex(new Uint16BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
