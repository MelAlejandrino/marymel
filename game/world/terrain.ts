import { WORLD_BOUNDS } from "./layout.ts";

/**
 * The land beyond the fence, as a height field.
 *
 * Free of three.js on purpose — `Terrain.tsx` samples this into one mesh, and
 * `terrain.test.ts` checks the things you cannot check by looking at a
 * screenshot: that the clearing is *exactly* flat, that the ground is
 * continuous everywhere, that the mesh is fine enough to hold the detail it is
 * asked to carry, and that the hills actually land where the composition wants
 * them.
 *
 * Three rules shaped all of it:
 *
 * 1. **The garden is flat and stays flat.** The player, the rabbits, the fence
 *    and the path stones all live at y = 0 and none of them sample the ground.
 *    So the height field is nailed to zero across the whole fenced clearing and
 *    only lifts outside it — the garden is a levelled meadow in a valley, which
 *    is both what the code needs and what a cottage garden actually is.
 * 2. **Distance from the middle of the world is distance from the camera.** The
 *    camera never leaves the clearing, so resolution can fall off with radius
 *    once, at build time, instead of being swapped at runtime.
 * 3. **The fog is the aerial perspective.** It already runs 48 → 140, so the
 *    hills are placed by how hazy they should read, not by how big they are.
 */

// --- shaping ----------------------------------------------------------------

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Smoothstep on an already-normalised 0..1 input. Flat at both ends, which is
 *  what keeps hills from meeting the ground along a crease. */
export function smoothstep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Quintic ease, used for the noise lattice. The cubic above is enough for a
 * mask but not for a surface: smoothstep has a discontinuous *second*
 * derivative, and interpolating a height field with it leaves faint ridges
 * along the lattice lines that catch the low sun exactly like corduroy.
 */
function quintic(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// --- noise ------------------------------------------------------------------

/**
 * Value noise, from the same sine hash the garden is scattered with
 * (`scatter.ts`) — deterministic, so the landscape composes identically on
 * every load and matches between the server and client render. No
 * `Math.random()` anywhere in the world.
 */
function hash2(ix: number, iz: number): number {
  const v = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Smooth 0..1 noise over the unit lattice. */
export function noise2(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const u = quintic(x - ix);
  const v = quintic(z - iz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/**
 * One octave, sampled on a lattice turned by `turn` radians and shifted by an
 * offset.
 *
 * Both matter. An axis-aligned lattice leaves faint north-south creases in the
 * ground, and stacking every octave on the *same* grid lines those creases up
 * into a visible weave — which is the single fastest way to make procedural
 * terrain look procedural.
 */
function octave(
  x: number,
  z: number,
  wavelength: number,
  turn: number,
  offset: number,
): number {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return noise2(
    (x * cos + z * sin) / wavelength + offset,
    (z * cos - x * sin) / wavelength - offset,
  );
}

// --- the clearing -----------------------------------------------------------

/**
 * Distance from the middle of the world, measured square-ish: mostly Chebyshev
 * (the larger of |x| and |z|), rounded off with a little Euclidean.
 *
 * It has to be square because the *fence* is square. A round clearing wide
 * enough to leave the fence corners on level ground — they are 34 out, against
 * 24 at the middle of each run — would have pushed the foot of every hill ten
 * metres further away for nothing. Rounding the corner off keeps the rim of the
 * valley from reading as a box.
 */
export function gardenEdge(x: number, z: number): number {
  const chebyshev = Math.max(Math.abs(x), Math.abs(z));
  return chebyshev * 0.85 + Math.hypot(x, z) * 0.15;
}

/**
 * Everything inside this is dead flat.
 *
 * Derived from the fence *corner* — the furthest point of the garden from the
 * middle, and the one the first cut of this left hanging over a slope — so
 * widening the world widens the clearing with it rather than quietly pushing
 * the fence into a hillside.
 */
export const CLEARING = gardenEdge(WORLD_BOUNDS, WORLD_BOUNDS) + 1.5;
/** How far past the clearing the ground takes to reach its full relief. */
const RISE_SPAN = 18;
/**
 * How much further out the hills start in some directions than others, so the
 * rim of the valley wanders instead of tracing `gardenEdge`.
 *
 * Only ever a *setback*: it can push the foot of the hills away from the
 * garden, never pull it in. That one-sidedness is what makes the flat clearing
 * provable rather than probable.
 */
const SETBACK = 5;

/**
 * How much of the landscape applies here: 0 across the whole clearing, 1 once
 * the ground is properly out in the hills.
 *
 * The early return is the load-bearing line in this file. Everything the player
 * stands on, walks past or sits down inside is inside the clearing, so this is
 * how the fence stays planted, the path stays level, and no rabbit ends up
 * hopping through a slope.
 */
export function riseWeight(x: number, z: number): number {
  const edge = gardenEdge(x, z) - noise2(x / 90 + 5.5, z / 90 - 2.5) * SETBACK;
  if (edge <= CLEARING) return 0;
  return smoothstep01((edge - CLEARING) / RISE_SPAN);
}

// --- the rolling ground -----------------------------------------------------

/** Wavelengths of the three octaves of open ground, in world units. */
const BROAD = 104;
const MEDIUM = 46;
export const DETAIL = 26;

/** How far the ground rolls just outside the fence, and out in the hills. */
const RELIEF_NEAR = 1.6;
const RELIEF_FAR = 5;

/**
 * How much of the finest octave survives at this radius.
 *
 * The mesh coarsens with distance (see `RING_BANDS`), and detail sampled below
 * about five vertices per wavelength stops reading as uneven ground and starts
 * reading as noise. So the height field gives up its detail at exactly the
 * radius the mesh can no longer carry it — which is also what haze does to real
 * ground, so the far hills come out as broad smooth masses for free.
 */
export function detailFade(radius: number): number {
  return 1 - smoothstep01((radius - 62) / 30);
}

/**
 * The open ground: slopes, shallow valleys and ridges, with none of the named
 * hills in it.
 *
 * The broad octave is sampled through a warp — the coordinates are pushed
 * around by a slower noise before being looked up — so its ridges bend and
 * meander rather than sitting in the neat blobby lattice that unwarped value
 * noise always gives.
 */
export function rolling(x: number, z: number): number {
  const radius = Math.hypot(x, z);

  const warp = 34;
  const wx = x + (octave(x, z, 190, 0.4, 11.3) - 0.5) * warp;
  const wz = z + (octave(x, z, 190, 2.1, 27.7) - 0.5) * warp;

  const shape =
    (octave(wx, wz, BROAD, 0, 3.1) - 0.5) * 1 +
    (octave(x, z, MEDIUM, 0.9, 19.4) - 0.5) * 0.55 +
    (octave(x, z, DETAIL, 1.9, 7.6) - 0.5) * 0.3 * detailFade(radius);

  // Gentle close in, dramatic far out. The swell just past the fence has to sit
  // *under* the treeline: the first cut of this rolled at full amplitude the
  // moment it left the clearing and buried the world it was supposed to frame.
  const relief =
    RELIEF_NEAR + smoothstep01((radius - 34) / 74) * (RELIEF_FAR - RELIEF_NEAR);

  return shape * relief;
}

// --- the hills ---------------------------------------------------------------

export type Hill = {
  x: number;
  z: number;
  /** Rise at the summit, in world units. */
  height: number;
  /** Reach of the foot, along its short axis. */
  radius: number;
  /** How much longer the hill is than it is wide. */
  stretch: number;
  /** Which way the long axis points. */
  angle: number;
  /** How far the foot wanders in and out, as a fraction of the radius. */
  wobble: number;
};

/**
 * Hand-placed, like the trees are (PLAN §16), because this is composition and
 * not decoration.
 *
 * Two measurements decided every number here, and both of them are surprising:
 *
 * - **There is barely any sky in the frame.** The follow camera sits at 4.2 and
 *   looks at her waist six metres ahead, so it is pitched about 27° *down*;
 *   the portrait frame is 78° tall, which leaves only ~12° above the horizontal
 *   on screen. A hill that reads as majestic in a landscape viewport is simply
 *   cropped here. Every summit below is aimed at 6–9° as seen from the gate:
 *   clear of the cottage ridge (4.6°) and the treeline (~1.2°), with sky left
 *   above it. The first cut of this stood at 21° and filled the whole frame
 *   with hillside.
 * - **The fog decides how big a hill is allowed to be.** It runs 48 → 140, so
 *   past about 130 out nothing is visible however tall it is. Distance was
 *   picked for how hazy each layer should read, and height then follows from
 *   the angle.
 *
 * Read as three depths, plus something to see when she turns round:
 *
 * - **midground** knolls at 45–75, crisp, sitting just above the treeline;
 * - **the massif** at 85–100, the thing you actually look at, offset well left
 *   of the cottage so its roofline reads against a flank, not a summit;
 * - **the range** past 120, all but gone in the haze from the gate — it is
 *   there for the walk *toward* it, which brings it out of the fog.
 */
export const HILLS: Hill[] = [
  // --- the massif: two masses and a saddle, never one cone -------------------
  { x: -44, z: -62, height: 13, radius: 44, stretch: 1.5, angle: 0.5, wobble: 0.3 },
  { x: -84, z: -28, height: 10.5, radius: 40, stretch: 1.35, angle: 1.15, wobble: 0.28 },
  // The answering ridge on the right: longer, lower and set further back, so
  // the two sides of the frame are never a matching pair.
  { x: 60, z: -64, height: 10, radius: 46, stretch: 1.6, angle: -0.6, wobble: 0.26 },
  { x: 92, z: -12, height: 11, radius: 42, stretch: 1.4, angle: -1.3, wobble: 0.24 },
  { x: -96, z: 28, height: 11, radius: 42, stretch: 1.5, angle: 1.4, wobble: 0.25 },

  // --- the range, out at the edge of the fog ---------------------------------
  { x: -24, z: -128, height: 20, radius: 80, stretch: 1.9, angle: 0.1, wobble: 0.2 },
  { x: -120, z: -100, height: 18, radius: 66, stretch: 1.5, angle: 0.8, wobble: 0.2 },
  { x: 112, z: -120, height: 17, radius: 62, stretch: 1.4, angle: -0.4, wobble: 0.2 },
  { x: 136, z: 64, height: 16, radius: 64, stretch: 1.55, angle: -1, wobble: 0.2 },
  // Three that exist to close gaps rather than to be looked at. She can turn
  // the camera through a full circle, and a quarter of the horizon with nothing
  // in it reads as the world being unfinished on that side. Kept far out, so
  // the valley still opens westward instead of being walled in.
  { x: 102, z: -58, height: 12.5, radius: 46, stretch: 1.5, angle: -0.9, wobble: 0.22 },
  { x: -106, z: -2, height: 13, radius: 46, stretch: 1.7, angle: 1.5, wobble: 0.22 },
  { x: -86, z: 72, height: 13.5, radius: 50, stretch: 1.4, angle: 0.9, wobble: 0.22 },

  // --- midground knolls -----------------------------------------------------
  // The layer that carries the composition, because it is the only one inside
  // the fog's near plane: everything further out is at least half haze, and a
  // scene where *every* layer is pale has no depth in it, only mist. These are
  // the crisp ridge the massif is read against.
  //
  // Out past 45, where the rise has finished — anything closer in is flattened
  // by the clearing — and no taller than about ten, or they stop being a step
  // out toward the massif and start hiding the treeline.
  // Dead ahead up the path, and a long low ridge rather than a knoll: it lies
  // across the view behind the treeline, which is what gives the cottage a
  // near band of ground to sit against before the massif starts.
  { x: -6, z: -46, height: 9, radius: 26, stretch: 2.6, angle: 0.15, wobble: 0.3 },
  { x: 34, z: -44, height: 8, radius: 28, stretch: 1.25, angle: -1.1, wobble: 0.35 },
  { x: 54, z: -14, height: 9.5, radius: 32, stretch: 1.45, angle: 0.3, wobble: 0.32 },
  { x: 52, z: 26, height: 8.5, radius: 30, stretch: 1.2, angle: 0.9, wobble: 0.33 },
  { x: -52, z: 22, height: 9.5, radius: 30, stretch: 1.3, angle: -0.7, wobble: 0.33 },
  { x: -46, z: -22, height: 9, radius: 28, stretch: 1.4, angle: 0.2, wobble: 0.35 },

  // --- behind the gate: kept low, so the way in still feels open ------------
  { x: -26, z: 62, height: 8, radius: 44, stretch: 1.5, angle: 0.4, wobble: 0.3 },
  { x: 68, z: 78, height: 11, radius: 46, stretch: 1.35, angle: -0.9, wobble: 0.25 },
  { x: -18, z: 138, height: 18, radius: 80, stretch: 1.8, angle: 0.2, wobble: 0.2 },
];

/** Widest the wobble can push a foot out, so the early-out below is safe. */
const MAX_WOBBLE = 0.45;

/** How much one hill lifts the ground at a point. */
export function hillRise(hill: Hill, x: number, z: number): number {
  const dx = x - hill.x;
  const dz = z - hill.z;
  const cos = Math.cos(hill.angle);
  const sin = Math.sin(hill.angle);
  // Into the hill's own frame, and normalised by its reach, so `d` is 0 at the
  // summit and 1 at the foot.
  const along = (dx * cos + dz * sin) / (hill.radius * hill.stretch);
  const across = (dz * cos - dx * sin) / hill.radius;
  const d = Math.hypot(along, across);
  if (d >= 1 + MAX_WOBBLE) return 0;

  // Pull the foot in and out with the same noise the open ground uses, so the
  // hill sits *in* the landscape rather than on top of it. Without this an
  // ellipse is an ellipse and the eye finds it immediately.
  const wobble = Math.min(hill.wobble, MAX_WOBBLE);
  const reach = 1 + (noise2(x / 70 + hill.x, z / 70 - hill.z) - 0.5) * 2 * wobble;
  const t = d / reach;
  if (t >= 1) return 0;

  // Flat at the foot *and* at the summit: a rounded top, and no crease where
  // the hill meets the ground.
  return hill.height * smoothstep01(1 - t);
}

/** Every hill, blended by taking the loudest rather than by adding up.
 *
 * A power-weighted mean, `Σh⁴ / Σh³`: a hill on its own comes through at
 * exactly its own height, two overlapping feet make a ridge with a real saddle
 * in it, and — the reason this is not a sum — nothing stacks.
 *
 * Summing them was the first cut and it failed twice over. The gap between the
 * two masses of the massif filled in higher than either summit, so the whole
 * thing read as one plateau; and the height of the ground became unbounded, so
 * no hill could be tuned without silently pushing a neighbour through the top
 * of the frame. A weighted mean can never exceed its largest term, which is
 * what lets `terrain.test.ts` put a hard ceiling on the whole landscape.
 */
export function hills(x: number, z: number): number {
  let top = 0;
  let weight = 0;
  for (const hill of HILLS) {
    const h = hillRise(hill, x, z);
    if (h <= 0) continue;
    // h³ as the weight, h⁴ as the sum: enough to pick out the tallest without
    // the seam that a hard max leaves where two flanks cross.
    const w = h * h * h;
    top += w * h;
    weight += w;
  }
  return weight === 0 ? 0 : top / weight;
}

// --- the height field -------------------------------------------------------

/** How high the ground is at a point. Zero everywhere inside the fence. */
export function terrainHeight(x: number, z: number): number {
  const rise = riseWeight(x, z);
  if (rise === 0) return 0;
  return rise * (rolling(x, z) + hills(x, z));
}

/**
 * The surface normal, from the height field itself rather than from the
 * triangles.
 *
 * Cheaper than it looks (four extra samples per vertex, once) and better in
 * two ways: the far rings are metres across, and shading them from their own
 * geometry would facet the background into flat plates, while the polar grid's
 * seam would need its normals matched by hand to avoid a visible crack. Taking
 * the gradient of the field skips both — it is the true slope of the ground
 * whatever the mesh under it happens to be doing.
 */
export function terrainNormal(
  x: number,
  z: number,
  eps = 1.1,
): [x: number, y: number, z: number] {
  const dx = terrainHeight(x + eps, z) - terrainHeight(x - eps, z);
  const dz = terrainHeight(x, z + eps) - terrainHeight(x, z - eps);
  const nx = -dx;
  const nz = -dz;
  const ny = 2 * eps;
  const length = Math.hypot(nx, ny, nz);
  return [nx / length, ny / length, nz / length];
}

/** Rise over run at a point: 0 on the level, 1 at 45°. */
export function terrainSlope(x: number, z: number, eps = 1.1): number {
  const [nx, ny, nz] = terrainNormal(x, z, eps);
  return Math.hypot(nx, nz) / Math.max(ny, 1e-6);
}

/**
 * How enclosed a point is: 0 out on an open slope or a summit, 1 down in a fold
 * with ground rising away on every side.
 *
 * Four samples a good stride out, against the height here. It is the cheapest
 * honest ambient occlusion there is, and it is the *only* shading the folds
 * would otherwise get: the shadow map is fitted to the garden (`Lighting.tsx`)
 * and casts nothing beyond it, so without this the hills come out as evenly lit
 * cloth with no depth in the valleys at all.
 */
export function terrainEnclosure(x: number, z: number, here: number, stride = 14): number {
  const rise =
    Math.max(0, terrainHeight(x + stride, z) - here) +
    Math.max(0, terrainHeight(x - stride, z) - here) +
    Math.max(0, terrainHeight(x, z + stride) - here) +
    Math.max(0, terrainHeight(x, z - stride) - here);
  // Nine metres of surrounding rise, averaged over the four, reads as fully
  // enclosed. Anything deeper than that is a gorge and there are none.
  return clamp01(rise / 36);
}

// --- colour -----------------------------------------------------------------

/**
 * How the ground is tinted here, as weights rather than colours: the palette
 * lives in `palette.ts` and the mixing lives in `Terrain.tsx`, so this file
 * stays testable without a renderer.
 *
 * All four are zero on level ground at y = 0 inside the near field — which is
 * the whole clearing — so the lawn keeps exactly the flat green it had when it
 * was a plane, and the meadow leaves it without a seam.
 */
export type Shade = {
  /** Sun-caught tops: drier, paler, less green. */
  dry: number;
  /** Stone breaking through where the ground is too steep to hold soil. */
  rock: number;
  /** Folds and hollows, where the sky reaches less. */
  hollow: number;
  /** How far the colour has given up to the air between here and the camera. */
  haze: number;
};

const FLAT: Shade = { dry: 0, rock: 0, hollow: 0, haze: 0 };

export function terrainShade(
  height: number,
  slope: number,
  radius: number,
  enclosure: number,
): Shade {
  return {
    // Ramped across the height the ground actually reaches — about -2 to 22 —
    // rather than across some round number: a ramp that runs out past the
    // tallest hill leaves the crest colour on screen nowhere at all.
    dry: smoothstep01((height - 5) / 13) * 0.8,
    rock: smoothstep01((slope - 0.6) / 0.45) * 0.75,
    hollow: clamp01(enclosure * 0.6 + smoothstep01(-height / 6) * 0.35),
    // Deliberately partial. The fog does most of the aerial perspective; this
    // only takes the saturation out of ground the fog has barely started on, so
    // the midground already reads as further away than the meadow.
    haze: smoothstep01((radius - 52) / 86) * 0.55,
  };
}

/**
 * Everything the mesh needs about one point, in one call.
 *
 * Bundled rather than left as four exported functions because they share their
 * samples: the height here feeds the gradient *and* the enclosure, so asking
 * separately would sample the field 12 times per vertex instead of 9.
 */
export type Sample = {
  height: number;
  normal: [x: number, y: number, z: number];
  shade: Shade;
};

export function terrainSample(x: number, z: number): Sample {
  // Inside the clearing there is nothing to sample: it is the lawn, and it
  // keeps exactly the flat green and the flat surface it had as a plane.
  if (riseWeight(x, z) === 0) {
    return { height: 0, normal: [0, 1, 0], shade: FLAT };
  }

  const height = terrainHeight(x, z);
  const normal = terrainNormal(x, z);
  const slope = Math.hypot(normal[0], normal[2]) / Math.max(normal[1], 1e-6);

  return {
    height,
    normal,
    shade: terrainShade(
      height,
      slope,
      Math.hypot(x, z),
      terrainEnclosure(x, z, height),
    ),
  };
}

// --- the mesh ---------------------------------------------------------------

/**
 * The ground reaches this far. Past the fog's far plane on purpose: the edge of
 * the world has to be *invisible*, not merely distant, and 140 out everything
 * is already pure fog colour against a fog-coloured horizon.
 */
export const TERRAIN_RADIUS = 185;

/** How many spokes the sampling grid has. */
export const TERRAIN_SEGMENTS = 160;

/**
 * Rings of the sampling grid, as `[reach, step]` bands.
 *
 * This is the level of detail, and it is free: the camera cannot leave the
 * clearing, so radius *is* distance from the camera and the mesh can be built
 * once at the right resolution instead of being swapped at runtime. Dense
 * across the rim and the near hills, where the silhouette is read; coarse over
 * the flat middle, where there is nothing to resolve, and out in the haze,
 * where nothing can be seen.
 */
export const RING_BANDS: Array<[reach: number, step: number]> = [
  [CLEARING - 1, 13],
  [56, 3],
  [96, 4.5],
  [140, 8],
  [TERRAIN_RADIUS, 16],
];

/** Radii of every ring, from the middle outward. */
export function ringRadii(): number[] {
  const out = [0];
  for (const [reach, step] of RING_BANDS) {
    const from = out[out.length - 1];
    const rings = Math.max(1, Math.round((reach - from) / step));
    for (let i = 1; i <= rings; i++) out.push(from + ((reach - from) * i) / rings);
  }
  return out;
}
