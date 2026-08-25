import type { InteractionVerb } from "../../interaction/nearest.ts";

/**
 * What each kind of spot is and how close you must get to it.
 *
 * Deliberately free of React and three.js: the admin's placement map needs the
 * interaction ranges to tell you whether a spot can actually be reached, and it
 * must not pull the renderer into its bundle to find out.
 */
export type SpotKindName = "ARCADE" | "FRAME" | "LETTER" | "KEEPSAKE";

export const SPOT_KINDS = {
  ARCADE: { verb: "PLAY", range: 2.4, label: "Arcade cabinet" },
  FRAME: { verb: "EXAMINE", range: 2.2, label: "Photo frame" },
  LETTER: { verb: "READ", range: 1.9, label: "Letter" },
  KEEPSAKE: { verb: "COLLECT", range: 1.8, label: "Keepsake" },
} as const satisfies Record<
  SpotKindName,
  { verb: InteractionVerb; range: number; label: string }
>;

export const spotRange = (kind: string): number =>
  SPOT_KINDS[kind as SpotKindName]?.range ?? 2;
