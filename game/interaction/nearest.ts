/**
 * The reusable half of the interaction system (PLAN §18): given everything
 * registered in the world and where the player is standing, which prompt
 * should show? Doors, NPCs, the claw machine, letters and future mini-games
 * all answer through this — none of them implement proximity themselves.
 */

export type InteractionVerb =
  | "INTERACT"
  | "OPEN"
  | "CLOSE"
  | "READ"
  | "COLLECT"
  | "PLAY"
  | "ENTER"
  | "EXAMINE";

export type Interactable = {
  id: string;
  x: number;
  z: number;
  /** How close the player must be, in world units. */
  range: number;
  verb: InteractionVerb;
  /** Shown in the prompt, e.g. "the door". */
  label: string;
  /** Registered but not currently offering anything, so it takes no prompt. */
  enabled: boolean;
  onInteract: () => void;
};

export type Candidate = Pick<
  Interactable,
  "id" | "x" | "z" | "range" | "enabled"
>;

/**
 * Nearest enabled interactable within its own range, or null.
 *
 * Ties break on id so a player standing equidistant between two objects gets
 * a stable prompt instead of one that flickers between them.
 */
export function findNearest<T extends Candidate>(
  items: readonly T[],
  player: { x: number; z: number },
): T | null {
  let best: T | null = null;
  let bestDistSq = Infinity;

  for (const item of items) {
    if (!item.enabled) continue;
    const dx = item.x - player.x;
    const dz = item.z - player.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > item.range * item.range) continue;

    if (distSq < bestDistSq || (distSq === bestDistSq && best && item.id < best.id)) {
      best = item;
      bestDistSq = distSq;
    }
  }

  return best;
}
