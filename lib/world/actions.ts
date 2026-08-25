"use server";

import { and, eq, notInArray, sql } from "drizzle-orm";

import { getViewer } from "../auth/dal.ts";
import {
  collectedItems,
  collectibles,
  db,
  discoveries,
  spots,
} from "../db/index.ts";
import { getRelationship } from "./query.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The client is untrusted, so an id coming back from it is checked against the
 * relationship's own spots rather than used directly (PLAN §23).
 */
async function requireSpot(spotId: string) {
  if (!UUID.test(spotId)) throw new Error("Not a thing in this world.");
  const relationship = await getRelationship();
  const [spot] = await db
    .select()
    .from(spots)
    .where(
      and(
        eq(spots.id, spotId),
        eq(spots.relationshipId, relationship.id),
        eq(spots.published, true),
      ),
    );
  if (!spot) throw new Error("Not a thing in this world.");
  return spot;
}

/** Records that she found a spot. Idempotent — walking back is not a new find. */
export async function discoverSpot(spotId: string): Promise<{ ok: true }> {
  const user = await getViewer();
  await requireSpot(spotId);

  await db
    .insert(discoveries)
    .values({ userId: user.id, spotId })
    .onConflictDoNothing();

  return { ok: true };
}

export type Prize = {
  id: string;
  title: string;
  message: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  type: string;
};

export type PrizeResult =
  /** Something new. Recorded in her collection. */
  | { outcome: "won"; prize: Prize; remaining: number }
  /**
   * She has already won everything in this cabinet, so it is free play: she
   * still gets a prize out and gets to read it again, but nothing new is
   * recorded. The arcade stays a toy instead of becoming an ornament.
   */
  | { outcome: "replay"; prize: Prize }
  /** The cabinet has no prizes in it at all. */
  | { outcome: "empty" };

const asPrize = (row: {
  id: string;
  title: string;
  message: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  type: string;
}): Prize => ({
  id: row.id,
  title: row.title,
  message: row.message,
  mediaUrl: row.mediaUrl,
  mediaAlt: row.mediaAlt,
  type: row.type,
});

/** Prizes in this cabinet she has not won yet. */
const stillToWin = (spotId: string, userId: string) =>
  and(
    eq(collectibles.spotId, spotId),
    sql`not exists (
      select 1 from ${collectedItems} ci
      where ci.collectible_id = ${collectibles.id} and ci.user_id = ${userId}
    )`,
  );

/**
 * Report a successful grab.
 *
 * ponytail: the claw decides *that* something was caught; this decides *what*,
 * and refuses to record the same prize twice. The claw itself replaces how the
 * catch is judged, not any of this.
 */
export async function playArcade(
  spotId: string,
  /**
   * Prize ids already shown in this visit to the cabinet.
   *
   * In free play every prize is already owned, so a random pick can hand back
   * the same one twice in a row — which reads as the machine being broken.
   * Client-supplied and therefore untrusted, but the worst a tampered list can
   * do is show her something she already has, which is the whole mode.
   */
  alreadyShown: string[] = [],
): Promise<PrizeResult> {
  const user = await getViewer();
  const spot = await requireSpot(spotId);
  if (spot.kind !== "ARCADE") throw new Error("That isn't something you can play.");

  const [fresh] = await db
    .select()
    .from(collectibles)
    .where(stillToWin(spotId, user.id))
    .orderBy(sql`random()`)
    .limit(1);

  // Playing a machine counts as having found it, win or replay.
  await db
    .insert(discoveries)
    .values({ userId: user.id, spotId })
    .onConflictDoNothing();

  if (fresh) {
    await db
      .insert(collectedItems)
      .values({ userId: user.id, collectibleId: fresh.id })
      .onConflictDoNothing();

    const [{ remaining }] = await db
      .select({ remaining: sql<number>`count(*)::int` })
      .from(collectibles)
      .where(stillToWin(spotId, user.id));

    return { outcome: "won", prize: asPrize(fresh), remaining };
  }

  // Nothing new left: free play. Hand back one she already has, and record
  // nothing — her collection is already complete for this cabinet.
  const seen = alreadyShown.filter((id) => UUID.test(id)).slice(0, 200);

  const unseen =
    seen.length > 0
      ? await db
          .select()
          .from(collectibles)
          .where(
            and(
              eq(collectibles.spotId, spotId),
              notInArray(collectibles.id, seen),
            ),
          )
          .orderBy(sql`random()`)
          .limit(1)
      : [];

  // Once she has been through them all, start again from anything.
  const [owned] = unseen.length
    ? unseen
    : await db
        .select()
        .from(collectibles)
        .where(eq(collectibles.spotId, spotId))
        .orderBy(sql`random()`)
        .limit(1);

  return owned ? { outcome: "replay", prize: asPrize(owned) } : { outcome: "empty" };
}
