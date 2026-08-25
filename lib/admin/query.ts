import "server-only";

import { asc, eq } from "drizzle-orm";

import {
  collectibles,
  db,
  memories,
  spots,
  users,
  type SpotKind,
} from "../db/index.ts";
import { getRelationship } from "../world/query.ts";

/**
 * The admin's view. Unlike `getWorld`, this deliberately returns *everything* —
 * unpublished spots and un-won prizes included. That is the point of an admin,
 * and it is safe because the page is behind `requireAdmin`.
 */

export type AdminPrize = {
  id: string;
  title: string;
  message: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  type: string;
};

export type AdminSpot = {
  id: string;
  kind: SpotKind;
  title: string;
  x: number;
  z: number;
  rotation: number;
  published: boolean;
  memory: {
    title: string;
    message: string | null;
    mediaUrl: string | null;
    mediaAlt: string | null;
    memoryDate: string | null;
    type: string;
  } | null;
  prizes: AdminPrize[];
};

export async function getAdminWorld() {
  const relationship = await getRelationship();

  const spotRows = await db
    .select({
      spot: spots,
      memory: memories,
    })
    .from(spots)
    .leftJoin(memories, eq(memories.spotId, spots.id))
    .where(eq(spots.relationshipId, relationship.id))
    .orderBy(asc(spots.kind), asc(spots.createdAt));

  const prizeRows = await db
    .select({ prize: collectibles })
    .from(collectibles)
    .innerJoin(spots, eq(spots.id, collectibles.spotId))
    .where(eq(spots.relationshipId, relationship.id))
    .orderBy(asc(collectibles.createdAt));

  const prizesBySpot = new Map<string, AdminPrize[]>();
  for (const { prize } of prizeRows) {
    const list = prizesBySpot.get(prize.spotId) ?? [];
    list.push({
      id: prize.id,
      title: prize.title,
      message: prize.message,
      mediaUrl: prize.mediaUrl,
      mediaAlt: prize.mediaAlt,
      type: prize.type,
    });
    prizesBySpot.set(prize.spotId, list);
  }

  const adminSpots: AdminSpot[] = spotRows.map(({ spot, memory }) => ({
    id: spot.id,
    kind: spot.kind,
    title: spot.title,
    x: spot.x,
    z: spot.z,
    rotation: spot.rotation,
    published: spot.published,
    memory: memory
      ? {
          title: memory.title,
          message: memory.message,
          mediaUrl: memory.mediaUrl,
          mediaAlt: memory.mediaAlt,
          memoryDate: memory.memoryDate,
          type: memory.type,
        }
      : null,
    prizes: prizesBySpot.get(spot.id) ?? [],
  }));

  const players = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "PLAYER"))
    .orderBy(asc(users.name));

  return { relationship, spots: adminSpots, players };
}
