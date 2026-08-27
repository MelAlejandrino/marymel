import type { Box } from "../collision.ts";
import { FURNITURE_COLLIDERS } from "./furniture.ts";

/**
 * One source of truth for the shape of the world. The meshes and the
 * collision pass both read from here, so a wall can never be drawn somewhere
 * you can walk through.
 *
 * Everything below is derived from the handful of constants at the top —
 * change `HOUSE.halfWidth` and the walls, roof, gable and colliders all
 * follow.
 */

/** The fence sits exactly here, so the limit of the world is something you
 *  can see rather than an invisible wall. */
export const WORLD_BOUNDS = 24;
export const PLAYER_RADIUS = 0.35;

export const HOUSE = {
  /** Inner face of the side walls. */
  halfWidth: 7,
  frontZ: -5,
  backZ: -15,
  wallHeight: 3.4,
  wallThickness: 0.4,
} as const;

export const ROOF = {
  /** How far the ridge sits above the top of the walls. */
  rise: 3.6,
  /** Eave overhang past the side walls, along x. */
  eaveOverhang: 0.7,
  /** Overhang past the front and back walls, along z. */
  gableOverhang: 0.6,
  thickness: 0.2,
} as const;

export const DOOR = {
  x: 0,
  z: HOUSE.frontZ,
  halfWidth: 0.95,
  height: 2.5,
  /** How close you must stand for the prompt to appear. */
  range: 2.8,
} as const;

/** Just inside the garden gate, so the walk to the door is the first thing
 *  that happens. */
export const SPAWN = { x: 0, z: 20.5 } as const;

const half = HOUSE.wallThickness / 2;

/**
 * `HOUSE.halfWidth`, `frontZ` and `backZ` are wall *centre* lines, so each
 * wall reaches half a thickness either side of them. The player stands at +z,
 * so the front wall's outer face is the one with the larger z.
 */
export const OUTER_HALF_WIDTH = HOUSE.halfWidth + half;
export const HOUSE_FRONT_OUTER = HOUSE.frontZ + half;
export const HOUSE_BACK_OUTER = HOUSE.backZ - half;
/** Inner faces — where the side walls have to stop to meet front and back. */
export const HOUSE_FRONT_INNER = HOUSE.frontZ - half;
export const HOUSE_BACK_INNER = HOUSE.backZ + half;
export const HOUSE_CENTRE_Z = (HOUSE.frontZ + HOUSE.backZ) / 2;
export const HOUSE_INNER_DEPTH = HOUSE_FRONT_INNER - HOUSE_BACK_INNER;
export const HOUSE_OUTER_DEPTH = HOUSE_FRONT_OUTER - HOUSE_BACK_OUTER;

/**
 * The roof is a gable with the ridge running front-to-back, so the front
 * elevation is a triangle above the door.
 */
export const ROOF_RUN = OUTER_HALF_WIDTH + ROOF.eaveOverhang;
export const ROOF_LENGTH = HOUSE_OUTER_DEPTH + ROOF.gableOverhang * 2;
export const ROOF_SLOPE_LENGTH = Math.hypot(ROOF_RUN, ROOF.rise);
export const ROOF_PITCH = Math.atan2(ROOF.rise, ROOF_RUN);
export const RIDGE_Y = HOUSE.wallHeight + ROOF.rise;

/** Height of the roofline at a given distance from the ridge. */
export function roofHeightAt(x: number): number {
  return RIDGE_Y - (ROOF.rise / ROOF_RUN) * Math.min(Math.abs(x), ROOF_RUN);
}

export type RoofSlab = {
  position: [x: number, y: number, z: number];
  /** Rotation about z, so the slab lies along the slope. */
  rotationZ: number;
  /** Box dimensions: along the slope, thickness, along the ridge. */
  size: [number, number, number];
};

/**
 * One slab per side. Each is a box whose long axis is rotated onto the slope;
 * because a box is symmetric about its centre, mirroring the pitch is enough
 * to make the second slab lean the other way.
 */
export function roofSlabs(): [RoofSlab, RoofSlab] {
  const size: [number, number, number] = [
    ROOF_SLOPE_LENGTH,
    ROOF.thickness,
    ROOF_LENGTH,
  ];
  return [-1, 1].map((side) => ({
    position: [
      (side * ROOF_RUN) / 2,
      HOUSE.wallHeight + ROOF.rise / 2,
      HOUSE_CENTRE_Z,
    ],
    rotationZ: -side * ROOF_PITCH,
    size,
  })) as [RoofSlab, RoofSlab];
}

/**
 * The gable end, as a closed outline in the wall plane with y measured from
 * the top of the wall. It follows the roofline exactly rather than being a
 * plain triangle — the eaves overhang the wall, so the roofline is already
 * above wall-top by the time it reaches the corner.
 */
export function gableOutline(): Array<[x: number, y: number]> {
  const shoulder = roofHeightAt(OUTER_HALF_WIDTH) - HOUSE.wallHeight;
  // A hair of overlap, so no seam shows where the gable meets the slabs.
  const bite = 0.06;
  return [
    [-OUTER_HALF_WIDTH, 0],
    [OUTER_HALF_WIDTH, 0],
    [OUTER_HALF_WIDTH, shoulder + bite],
    [0, ROOF.rise + bite],
    [-OUTER_HALF_WIDTH, shoulder + bite],
  ];
}

// --- walls ------------------------------------------------------------------

/** Front wall either side of the doorway, meeting the side walls flush. */
export const FRONT_SEGMENTS: Box[] = [-1, 1].map((side) => {
  const hx = (OUTER_HALF_WIDTH - DOOR.halfWidth) / 2;
  return { x: side * (DOOR.halfWidth + hx), z: HOUSE.frontZ, hx, hz: half };
});

export const SIDE_WALLS: Box[] = [-1, 1].map((side) => ({
  x: side * HOUSE.halfWidth,
  z: HOUSE_CENTRE_Z,
  hx: half,
  hz: HOUSE_INNER_DEPTH / 2,
}));

export const BACK_WALL: Box = {
  x: 0,
  z: HOUSE.backZ,
  hx: OUTER_HALF_WIDTH,
  hz: half,
};

/** Blocks the doorway while the door is shut; dropped once it opens. */
export const DOOR_COLLIDER: Box = {
  x: DOOR.x,
  z: DOOR.z,
  hx: DOOR.halfWidth,
  hz: half,
};

/**
 * The front elevation as an outline plus holes, in the wall plane with y
 * measured from the ground. The wall is extruded from this rather than being
 * built from boxes around the openings — a box wall means the window can only
 * ever be painted on the outside, which is exactly what it looked like: a
 * curtain hanging in front of blank plaster.
 *
 * Returned as plain point lists so this file stays free of three.js and the
 * admin map can keep importing it.
 */
export function frontWallOutline(): Array<[x: number, y: number]> {
  return [
    [-OUTER_HALF_WIDTH, 0],
    [OUTER_HALF_WIDTH, 0],
    [OUTER_HALF_WIDTH, HOUSE.wallHeight],
    [-OUTER_HALF_WIDTH, HOUSE.wallHeight],
  ];
}

/** A rectangle as a closed outline, counter-clockwise. */
function rect(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
): Array<[x: number, y: number]> {
  return [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ];
}

/**
 * The openings cut out of the front wall: the doorway, and one hole per
 * window.
 *
 * Every hole must sit *strictly* inside the outline. A hole that touches or
 * crosses the shape's own edge gives the triangulator a degenerate case and
 * the wall comes out with stray slivers in it — so the doorway stops a
 * centimetre above the ground, which the interior floor at y 0.02 covers.
 */
const THRESHOLD = 0.01;

export function frontWallHoles(): Array<Array<[x: number, y: number]>> {
  return [
    rect(
      DOOR.x,
      (DOOR.height + THRESHOLD) / 2,
      DOOR.halfWidth,
      (DOOR.height - THRESHOLD) / 2,
    ),
    ...WINDOWS.map((win) =>
      rect(win.x, win.y, WINDOW.width / 2, WINDOW.height / 2),
    ),
  ];
}

export const WINDOW = {
  width: 1.5,
  height: 1.4,
  frame: 0.14,
  /** How far the sill hangs below the pane. */
  sillDrop: 0.24,
} as const;

export const WINDOWS = [
  { x: -4.4, y: 1.95 },
  { x: 4.4, y: 1.95 },
] as const;

/** Flower box hung off each sill. */
export const WINDOW_BOX = { width: WINDOW.width + 0.5, height: 0.3, depth: 0.34 } as const;

/** Round window in the front gable. */
export const GABLE_WINDOW = {
  y: HOUSE.wallHeight + 1.5,
  radius: 0.55,
  rim: 0.08,
} as const;

export const CHIMNEY = {
  /** Lined up over the hearth inside, so the flue is a straight run. */
  x: 6.2,
  z: -12.6,
  width: 0.75,
  top: RIDGE_Y + 0.6,
  /** Start this far below the roofline, so no gap shows where it pierces. */
  sink: 0.9,
} as const;

export const DOORSTEP = {
  z: HOUSE.frontZ + 0.9,
  halfWidth: 1.6,
  depth: 1.6,
  height: 0.14,
} as const;

/** Lantern posts either side of the door, clear of the step. */
export const LANTERNS = [-1.95, 1.95] as const;

/** The hearth, set into the right-hand wall directly under the chimney. */
export const HEARTH = {
  x: HOUSE.halfWidth - HOUSE.wallThickness / 2,
  z: CHIMNEY.z,
  width: 1.9,
  height: 1.5,
  depth: 0.55,
} as const;

// --- garden -----------------------------------------------------------------

export type Tree = { x: number; z: number; scale: number; tint: number };

/** Hand-placed rather than random, so the composition is stable (PLAN §16).
 *  Read as a rough ring: a loose orchard near the cottage, then a denser
 *  treeline at the fence that closes the world off without a wall. */
export const TREES: Tree[] = [
  // --- the orchard, close in ---
  { x: -10.5, z: -3, scale: 1.25, tint: 0 },
  { x: -9.2, z: 5.5, scale: 0.95, tint: 1 },
  { x: 10.4, z: -2, scale: 1.1, tint: 2 },
  { x: 9.1, z: 6.5, scale: 0.85, tint: 0 },
  { x: -12.4, z: 10.5, scale: 1.05, tint: 1 },
  { x: 12.2, z: 9.5, scale: 0.9, tint: 0 },
  { x: 4.6, z: 13.5, scale: 1, tint: 2 },
  { x: -5.2, z: 14.5, scale: 1.15, tint: 0 },
  { x: -10.8, z: -11, scale: 1.2, tint: 2 },
  { x: 11.2, z: -12.5, scale: 1.15, tint: 1 },
  { x: -6.5, z: -17.5, scale: 1.1, tint: 0 },
  { x: 5.5, z: -18, scale: 1.05, tint: 2 },
  // --- the treeline, tall and packed against the fence ---
  { x: -20.5, z: -16, scale: 1.5, tint: 2 },
  { x: -19.5, z: -6.5, scale: 1.35, tint: 0 },
  { x: -20.8, z: 3, scale: 1.45, tint: 1 },
  { x: -19.2, z: 12.5, scale: 1.3, tint: 2 },
  { x: -14, z: 19.5, scale: 1.4, tint: 0 },
  { x: -3.5, z: 20.8, scale: 1.25, tint: 1 },
  { x: 8.5, z: 20.2, scale: 1.35, tint: 2 },
  { x: 16.5, z: 17, scale: 1.45, tint: 0 },
  { x: 20.6, z: 6, scale: 1.4, tint: 1 },
  { x: 19.8, z: -4, scale: 1.3, tint: 2 },
  { x: 20.4, z: -14.5, scale: 1.5, tint: 0 },
  { x: 14.5, z: -20, scale: 1.35, tint: 1 },
  { x: 1.5, z: -20.5, scale: 1.45, tint: 2 },
  { x: -13.5, z: -20.2, scale: 1.4, tint: 1 },
];

const TRUNK_RADIUS = 0.3;

/** The stone surround stands proud of the wall, so it has to be solid. */
export const HEARTH_COLLIDER: Box = {
  x: HEARTH.x - HEARTH.depth / 2,
  z: HEARTH.z,
  hx: HEARTH.depth / 2,
  hz: (HEARTH.width + 0.7) / 2,
};

export const STATIC_COLLIDERS: Box[] = [
  ...FRONT_SEGMENTS,
  ...SIDE_WALLS,
  BACK_WALL,
  HEARTH_COLLIDER,
  ...FURNITURE_COLLIDERS,
  ...TREES.map((tree) => ({
    x: tree.x,
    z: tree.z,
    hx: TRUNK_RADIUS * tree.scale,
    hz: TRUNK_RADIUS * tree.scale,
  })),
];

/** Colliders for the current world state. The door is the only moving part. */
export function collidersFor(doorOpen: boolean): Box[] {
  return doorOpen ? STATIC_COLLIDERS : [...STATIC_COLLIDERS, DOOR_COLLIDER];
}

export const FENCE = {
  /** Half-width of the gap the path runs through. */
  gateHalfWidth: 1.7,
  postSpacing: 0.44,
  height: 1.05,
} as const;

/** Stepping stones from the gate up to the doorstep. Derived from the bounds,
 *  so widening the world lengthens the path instead of leaving it short. */
const PATH_STEP = 1.6;
const PATH_START_Z = WORLD_BOUNDS - 2;
const PATH_END_Z = DOORSTEP.z + DOORSTEP.depth / 2 + 0.4;

export const PATH_STONES = Array.from(
  { length: Math.round((PATH_START_Z - PATH_END_Z) / PATH_STEP) + 1 },
  (_, i) => ({
  z: PATH_START_Z - i * PATH_STEP,
  // Alternate a little so the path meanders instead of reading as a ruler.
  x: (i % 2 === 0 ? 1 : -1) * 0.18,
  rotation: (i * 1.7) % Math.PI,
  scale: 0.92 + ((i * 7) % 3) * 0.07,
  }),
);
