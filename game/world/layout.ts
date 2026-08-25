import type { Box } from "../collision.ts";

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
export const WORLD_BOUNDS = 15;
export const PLAYER_RADIUS = 0.35;

export const HOUSE = {
  /** Inner face of the side walls. */
  halfWidth: 4.5,
  frontZ: -5,
  backZ: -12,
  wallHeight: 2.8,
  wallThickness: 0.4,
} as const;

export const ROOF = {
  /** How far the ridge sits above the top of the walls. */
  rise: 3,
  /** Eave overhang past the side walls, along x. */
  eaveOverhang: 0.5,
  /** Overhang past the front and back walls, along z. */
  gableOverhang: 0.45,
  thickness: 0.18,
} as const;

export const DOOR = {
  x: 0,
  z: HOUSE.frontZ,
  halfWidth: 0.85,
  height: 2.2,
  /** How close you must stand for the prompt to appear. */
  range: 2.8,
} as const;

/** Just inside the garden gate, so the walk to the door is the first thing
 *  that happens. */
export const SPAWN = { x: 0, z: 12.5 } as const;

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

export const WINDOW = {
  width: 1.15,
  height: 1.05,
  frame: 0.12,
  /** How far the sill hangs below the pane. */
  sillDrop: 0.21,
} as const;

export const WINDOWS = [
  { x: -2.7, y: 1.65 },
  { x: 2.7, y: 1.65 },
] as const;

/** Round window in the front gable. */
export const GABLE_WINDOW = {
  y: HOUSE.wallHeight + 1.15,
  radius: 0.42,
  rim: 0.07,
} as const;

export const CHIMNEY = {
  x: 2.6,
  z: -10.4,
  width: 0.62,
  top: RIDGE_Y + 0.5,
  /** Start this far below the roofline, so no gap shows where it pierces. */
  sink: 0.9,
} as const;

export const DOORSTEP = {
  z: HOUSE.frontZ + 0.75,
  halfWidth: 1.3,
  depth: 1.3,
  height: 0.12,
} as const;

/** Lantern posts either side of the door, clear of the step. */
export const LANTERNS = [-1.55, 1.55] as const;

// --- garden -----------------------------------------------------------------

export type Tree = { x: number; z: number; scale: number; tint: number };

/** Hand-placed rather than random, so the composition is stable (PLAN §16). */
export const TREES: Tree[] = [
  { x: -9.5, z: -3, scale: 1.25, tint: 0 },
  { x: -7.6, z: 4.5, scale: 0.95, tint: 1 },
  { x: 9.2, z: -2, scale: 1.1, tint: 2 },
  { x: 7.4, z: 6, scale: 0.85, tint: 0 },
  { x: -13, z: -9, scale: 1.4, tint: 2 },
  { x: 12.6, z: -8, scale: 1.3, tint: 1 },
  { x: 3.5, z: 11.5, scale: 1, tint: 2 },
  { x: -4.5, z: 12, scale: 1.15, tint: 0 },
  { x: -12, z: 6, scale: 1.05, tint: 1 },
  { x: 11.5, z: 8, scale: 0.9, tint: 0 },
];

const TRUNK_RADIUS = 0.3;

export const STATIC_COLLIDERS: Box[] = [
  ...FRONT_SEGMENTS,
  ...SIDE_WALLS,
  BACK_WALL,
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

/** Stepping stones from the gate up to the doorstep. */
export const PATH_STONES = Array.from({ length: 11 }, (_, i) => ({
  z: 13 - i * 1.6,
  // Alternate a little so the path meanders instead of reading as a ruler.
  x: (i % 2 === 0 ? 1 : -1) * 0.18,
  rotation: (i * 1.7) % Math.PI,
  scale: 0.92 + ((i * 7) % 3) * 0.07,
}));
