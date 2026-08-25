import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { cache } from "react";

import {
  collectedItems,
  collectibles,
  db,
  discoveries,
  memories,
  relationships,
  spots,
  type SpotKind,
} from "../db/index.ts";

/**
 * The world is open: there are no chapters and nothing is time-locked, so a
 * spot's memory is sent with the page and the reveal is instant.
 *
 * Arcade prizes are the one exception. Those stay on the server until she
 * actually wins one — shipping the prize list would spoil the only surprise
 * left in the model.
 */
export type RevealedMemory = {
  id: string;
  title: string;
  message: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  memoryDate: string | null;
  type: string;
};

export type PlayerSpot = {
  id: string;
  kind: SpotKind;
  title: string;
  x: number;
  z: number;
  rotation: number;
  config: Record<string, unknown> | null;
  discovered: boolean;
  memory: RevealedMemory | null;
  /** Present for ARCADE spots: how many prizes there are, and how many she has. */
  prizes: { total: number; won: number } | null;
};

export const getRelationship = cache(async () => {
  const [row] = await db.select().from(relationships).limit(1);
  if (!row) throw new Error("No relationship configured — run `npm run db:seed`.");
  return row;
});

export const getWorld = cache(async (userId: string): Promise<PlayerSpot[]> => {
  const relationship = await getRelationship();

  const rows = await db
    .select({
      spot: spots,
      memory: memories,
      discovered: discoveries.id,
    })
    .from(spots)
    .leftJoin(memories, eq(memories.spotId, spots.id))
    .leftJoin(
      discoveries,
      and(eq(discoveries.spotId, spots.id), eq(discoveries.userId, userId)),
    )
    .where(and(eq(spots.relationshipId, relationship.id), eq(spots.published, true)))
    .orderBy(asc(spots.createdAt));

  // Prize counts only — never the prizes themselves.
  const counts = await db
    .select({
      spotId: collectibles.spotId,
      total: sql<number>`count(*)::int`,
      won: sql<number>`count(${collectedItems.id})::int`,
    })
    .from(collectibles)
    .leftJoin(
      collectedItems,
      and(
        eq(collectedItems.collectibleId, collectibles.id),
        eq(collectedItems.userId, userId),
      ),
    )
    .groupBy(collectibles.spotId);

  const bySpot = new Map(counts.map((c) => [c.spotId, c]));

  return rows.map(({ spot, memory, discovered }) => {
    const prizes = bySpot.get(spot.id);
    return {
      id: spot.id,
      kind: spot.kind,
      title: spot.title,
      x: spot.x,
      z: spot.z,
      rotation: spot.rotation,
      config: (spot.config as Record<string, unknown> | null) ?? null,
      discovered: discovered !== null,
      memory: memory
        ? {
            id: memory.id,
            title: memory.title,
            message: memory.message,
            mediaUrl: memory.mediaUrl,
            mediaAlt: memory.mediaAlt,
            memoryDate: memory.memoryDate,
            type: memory.type,
          }
        : null,
      prizes: prizes ? { total: prizes.total, won: prizes.won } : null,
    };
  });
});
