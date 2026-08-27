import type { Box } from "../collision.ts";
import type { InteractionVerb } from "../interaction/nearest.ts";

/**
 * Where the furniture stands.
 *
 * Kept apart from `layout.ts` on purpose: layout owns the *shell* of the
 * world, this owns what has been carried into it. layout imports this to build
 * colliders, so the import only ever runs one way and there is no cycle.
 *
 * Every piece is hand-placed. The room is 13.6 x 9.6 — x runs -6.8..6.8 and
 * z runs -14.8 (back wall) to -5.2 (front wall, with the door at x 0). The
 * hearth is set into the right-hand wall at z -12.6, and the middle of the
 * room stays clear so there is somewhere to walk.
 *
 * `hx`/`hz` are the footprint's half-extents *before* rotation; `footprint()`
 * turns them into the axis-aligned box collision actually uses.
 */

export type FurnitureKind =
  | "sofa"
  | "armchair"
  | "coffeeTable"
  | "bookshelf"
  | "bed"
  | "roundTable"
  | "chair"
  | "console"
  | "plant"
  | "logBasket";

export type Furniture = {
  kind: FurnitureKind;
  x: number;
  z: number;
  /** Radians about Y. */
  rotation: number;
  /** Footprint half-extents in the piece's own axes. */
  hx: number;
  hz: number;
  /** Set for anything you should be able to walk straight through. */
  passable?: boolean;
  /** Kind-specific trimmings, so two sofas need not be identical. */
  tint?: number;
  /**
   * What she can actually do with it. A piece with no action is scenery, takes
   * no prompt, and is better off saying nothing than offering a note about
   * itself — reading a caption is not an interaction.
   */
  action?: FurnitureAction;
};

/**
 * Seat surface heights.
 *
 * Tuned to *her* legs, not to a person's. Her whole leg is 0.4 long, so an
 * adult chair at 0.45 leaves her feet a long way off the floor — she reads as
 * a doll propped on the furniture. Both the meshes and the seat offsets below
 * are built from these, so a chair cannot be drawn at one height and sat on at
 * another.
 */
/**
 * How far forward each seat's structure reaches — the front face of the base,
 * which is what her shins would come down through.
 *
 * The meshes are built from these and the seat offsets below are placed against
 * them, because the two have to agree: she has to sit far enough forward that
 * her knees clear this edge. Her thigh reaches only ~0.21, so on a
 * conventionally deep seat her legs end up *inside* the furniture and sitting
 * looks like standing with the legs deleted.
 */
export const SEAT_FRONT = {
  // Shallower than a sofa built for an adult. At 0.48 her knees cleared the
  // front edge by under 3cm, which is not "sitting on it" so much as "not quite
  // inside it".
  sofa: 0.44,
  armchair: 0.42,
  chair: 0.25,
} as const;

export const SEAT_SURFACE = {
  sofa: 0.44,
  armchair: 0.42,
  chair: 0.36,
  /** Top of the duvet. */
  bed: 0.75,
} as const;

/**
 * Where she rests, in the piece's own axes, so it turns with the piece: get it
 * right on the sofa once and the sofa can be moved anywhere. `y` is the surface
 * height, not the avatar's origin — see `poseHeight()`.
 */
export type SeatOffset = { x: number; y: number; z: number };

/** Just the geometry — the only part the maths below needs. */
export type Footprint = Pick<Furniture, "x" | "z" | "rotation" | "hx" | "hz">;

/**
 * `label` only ever names the thing — "the sofa". The verb in front of it comes
 * from the HUD's own table, so a prompt reads "Sit on the sofa" and the wording
 * of every prompt in the game stays in one place.
 */
export type FurnitureAction =
  /** She gets on it, and the controls hand over until she gets off. */
  | { kind: "seat"; verb: "SIT" | "LIE"; label: string; seat: SeatOffset }
  /**
   * Flips a visible state: a lid, a lamp, a book off a shelf. Both halves are
   * spelled out, because "on" and "off" are not the same words for a trunk as
   * for a lamp.
   */
  | {
      kind: "toggle";
      idle: { verb: InteractionVerb; label: string };
      active: { verb: InteractionVerb; label: string };
    }
  /** One-shot, with a visible consequence somewhere else in the room. */
  | { kind: "stoke"; verb: "STOKE"; label: string };

/**
 * Turn a seat offset into a world position and facing. Rotation about Y, so
 * local +z is the way the piece faces and she ends up facing the same way —
 * which is why the sofa faces the fire and she does too.
 */
export function seatAnchor(
  item: Footprint & { action?: FurnitureAction },
): { x: number; y: number; z: number; facing: number } | null {
  const action = item.action;
  if (action?.kind !== "seat") return null;

  const { x: sx, y: sy, z: sz } = action.seat;
  const cos = Math.cos(item.rotation);
  const sin = Math.sin(item.rotation);

  return {
    x: item.x + sx * cos + sz * sin,
    y: sy,
    z: item.z - sx * sin + sz * cos,
    facing: item.rotation,
  };
}

export const FURNITURE: Furniture[] = [
  // --- by the fire: sofa and chair drawn up to the hearth ------------------
  {
    kind: "sofa",
    x: 3.1,
    z: -12.6,
    rotation: Math.PI / 2,
    hx: 1.1,
    hz: 0.48,
    action: {
      kind: "seat",
      verb: "SIT",
      label: "the sofa",
      // Well forward on the cushion, so her knees clear the front of it.
      seat: { x: 0, y: SEAT_SURFACE.sofa, z: 0.3 },
    },
  },
  {
    kind: "coffeeTable",
    x: 4.5,
    z: -12.6,
    rotation: 0,
    hx: 0.5,
    hz: 0.35,
  },
  {
    kind: "armchair",
    x: 4.6,
    z: -10.5,
    rotation: 2.5,
    hx: 0.42,
    hz: 0.42,
    action: {
      kind: "seat",
      verb: "SIT",
      label: "the good chair",
      seat: { x: 0, y: SEAT_SURFACE.armchair, z: 0.28 },
    },
  },
  {
    kind: "logBasket",
    x: 6.0,
    z: -10.9,
    rotation: 0.3,
    hx: 0.3,
    hz: 0.3,
    action: { kind: "stoke", verb: "STOKE", label: "the fire" },
  },

  // --- the left wall. Kept clear around z -8.6, where a picture hangs. ----
  {
    kind: "bookshelf",
    x: -6.35,
    z: -10.4,
    rotation: Math.PI / 2,
    hx: 1.1,
    hz: 0.28,
  },
  {
    kind: "plant",
    x: -6.2,
    z: -6.1,
    rotation: 0,
    hx: 0.34,
    hz: 0.34,
  },

  // --- the bed, tucked into the back-left corner --------------------------
  {
    kind: "bed",
    x: -5.0,
    z: -13.4,
    rotation: 0,
    hx: 0.9,
    hz: 1.1,
    action: {
      kind: "seat",
      verb: "LIE",
      label: "the bed",
      // Feet at the foot of the bed; she extends back toward the headboard.
      seat: { x: 0, y: SEAT_SURFACE.bed, z: 0.72 },
    },
  },

  // --- breakfast nook under the left-hand window --------------------------
  {
    kind: "roundTable",
    x: -4.3,
    z: -7.0,
    rotation: 0,
    hx: 0.72,
    hz: 0.72,
  },
  {
    kind: "chair",
    x: -5.6,
    z: -7.0,
    rotation: Math.PI / 2,
    hx: 0.28,
    hz: 0.28,
    action: {
      kind: "seat",
      verb: "SIT",
      label: "this chair",
      seat: { x: 0, y: SEAT_SURFACE.chair, z: 0.12 },
    },
  },
  {
    kind: "chair",
    x: -3.0,
    z: -7.0,
    rotation: -Math.PI / 2,
    hx: 0.28,
    hz: 0.28,
    tint: 1,
    action: {
      kind: "seat",
      verb: "SIT",
      label: "the other chair",
      seat: { x: 0, y: SEAT_SURFACE.chair, z: 0.12 },
    },
  },

  // --- by the door --------------------------------------------------------
  {
    kind: "console",
    x: 4.4,
    z: -5.9,
    rotation: Math.PI,
    hx: 0.85,
    hz: 0.25,
    action: {
      // Left on, so the first press is the one that turns it off.
      kind: "toggle",
      idle: { verb: "TURN_OFF", label: "the lamp" },
      active: { verb: "TURN_ON", label: "the lamp" },
    },
  },
  {
    kind: "plant",
    x: 6.1,
    z: -6.2,
    rotation: 0.8,
    hx: 0.34,
    hz: 0.34,
  },
];

/**
 * The axis-aligned box a piece occupies once it is turned. Rotating a
 * rectangle and re-bounding it is conservative — a piece at 45° claims a
 * little more floor than it covers — which is the right way round: you bump
 * into the armchair slightly early rather than walking through its corner.
 */
export function footprint(item: Footprint): Box {
  const c = Math.abs(Math.cos(item.rotation));
  const s = Math.abs(Math.sin(item.rotation));
  return {
    x: item.x,
    z: item.z,
    hx: c * item.hx + s * item.hz,
    hz: s * item.hx + c * item.hz,
  };
}

/**
 * How close she has to stand. Derived from the footprint so a sofa is
 * approachable from further off than a trunk, with a small margin — big enough
 * to walk up to, tight enough that a nearby letter or picture still wins the
 * prompt (`findNearest` takes whichever is closest).
 */
export function actionRange(item: Footprint): number {
  return Math.hypot(item.hx, item.hz) + 0.6;
}

export const FURNITURE_COLLIDERS: Box[] = FURNITURE.filter(
  (item) => !item.passable,
).map(footprint);

/** Rugs are flat, so they are drawn but never collided with. */
export const RUGS = [
  { x: 0, z: -9, radius: 2.6 },
  { x: 4.3, z: -12.6, radius: 1.5 },
] as const;

/** Sconces on the side walls, between the pieces of furniture. */
export const SCONCES = [
  { x: -6.72, z: -12.4 },
  { x: -6.72, z: -6.2 },
  { x: 6.72, z: -6.6 },
] as const;
