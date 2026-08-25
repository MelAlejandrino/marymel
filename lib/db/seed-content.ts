import type { SpotKind } from "./schema.ts";

/**
 * The starting layout of the world.
 *
 * Placeholder content only — no real names, photos, or messages. Replace it
 * through the admin dashboard rather than by editing this file.
 *
 * Coordinates are world units: the cottage interior is roughly x -4.3..4.3,
 * z -11.8..-5.2, the garden runs out to the fence at +/-15, and the path down
 * the middle is |x| < 1.5. `seed-content.test.ts` checks every placement is
 * out of the walls and standable next to.
 */

export type SeedMemory = {
  title: string;
  message: string;
  memoryDate?: string;
  type: "PHOTO" | "LETTER" | "MEMORY" | "MESSAGE" | "GIFT" | "SPECIAL";
};

export type SeedPrize = {
  title: string;
  message: string;
  type: SeedMemory["type"];
};

export type SeedSpot = {
  kind: SpotKind;
  /** Reads inside a prompt: "Read the note on the step". */
  title: string;
  x: number;
  z: number;
  rotation?: number;
  config?: Record<string, unknown>;
  memory?: SeedMemory;
  prizes?: SeedPrize[];
};

const placeholder = "Placeholder — replace this in the admin dashboard.";

export const SEED_SPOTS: SeedSpot[] = [
  // --- the arcade corner, inside the cottage -------------------------------
  {
    kind: "ARCADE",
    title: "the claw machine",
    x: 2.3,
    z: -10.9,
    // `game` picks the cabinet's visual and its mini-game (PLAN mini-game
    // registry). Adding another needs no migration.
    config: { game: "claw" },
    prizes: [
      { title: "A folded note", message: placeholder, type: "LETTER" },
      { title: "A tiny star", message: placeholder, type: "SPECIAL" },
      { title: "A pressed flower", message: placeholder, type: "GIFT" },
      { title: "A ticket stub", message: placeholder, type: "MEMORY" },
    ],
  },
  {
    kind: "ARCADE",
    title: "the photo booth",
    x: -2.3,
    z: -10.9,
    config: { game: "booth" },
    prizes: [
      { title: "A strip of four", message: placeholder, type: "PHOTO" },
      { title: "The blurry one", message: placeholder, type: "PHOTO" },
      { title: "The one you hate", message: placeholder, type: "PHOTO" },
      { title: "The good one", message: placeholder, type: "PHOTO" },
    ],
  },

  // --- frames on the interior walls ---------------------------------------
  {
    kind: "FRAME",
    title: "the picture by the window",
    x: -4,
    z: -8.2,
    // Facing +x, into the room, off the left-hand wall.
    rotation: Math.PI / 2,
    config: { tint: 0 },
    memory: { title: "A photo of us", message: placeholder, type: "PHOTO" },
  },
  {
    kind: "FRAME",
    title: "the little portrait",
    x: 4,
    z: -8.2,
    rotation: -Math.PI / 2,
    config: { tint: 3 },
    memory: { title: "Another photo", message: placeholder, type: "PHOTO" },
  },
  {
    kind: "FRAME",
    title: "the picture in the garden",
    x: 5.6,
    z: 1.8,
    rotation: -0.5,
    config: { tint: 1 },
    memory: { title: "Somewhere we went", message: placeholder, type: "PHOTO" },
  },

  // --- letters ------------------------------------------------------------
  {
    kind: "LETTER",
    title: "the note on the step",
    x: 1.05,
    z: -3.3,
    rotation: 0.2,
    memory: {
      title: "Before you go in",
      message: placeholder,
      type: "LETTER",
    },
  },
  {
    kind: "LETTER",
    title: "the note under the tree",
    x: -6.4,
    z: 3.4,
    rotation: 0.7,
    memory: { title: "Something I meant to say", message: placeholder, type: "LETTER" },
  },

  // --- keepsakes, tucked out of the way -----------------------------------
  {
    kind: "KEEPSAKE",
    title: "something behind the house",
    x: 0.8,
    z: -13.5,
    memory: { title: "An inside joke", message: placeholder, type: "SPECIAL" },
  },
  {
    kind: "KEEPSAKE",
    title: "something by the gate",
    x: -2.8,
    z: 12.6,
    memory: { title: "The first thing", message: placeholder, type: "MEMORY" },
  },
  {
    kind: "KEEPSAKE",
    title: "something in the flowers",
    x: 8.4,
    z: -5.2,
    memory: { title: "A small gift", message: placeholder, type: "GIFT" },
  },
];

/** How many separate things there are to find, for the collection counter. */
export function countFindable(spots: SeedSpot[] = SEED_SPOTS): number {
  return spots.reduce(
    (n, s) => n + (s.memory ? 1 : 0) + (s.prizes?.length ?? 0),
    0,
  );
}
