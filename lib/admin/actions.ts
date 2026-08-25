"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "../auth/dal.ts";
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
import { uploadFromForm } from "../media/cloudinary.ts";
import { getRelationship } from "../world/query.ts";

/**
 * Every action here re-checks the admin role against the database and every
 * id against the relationship's own rows. The forms are plain server-action
 * forms, so none of this depends on client JavaScript running.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: SpotKind[] = ["ARCADE", "FRAME", "LETTER", "KEEPSAKE"];
const TYPES = ["PHOTO", "LETTER", "MEMORY", "MESSAGE", "GIFT", "SPECIAL"] as const;
type ContentType = (typeof TYPES)[number];

function refresh() {
  revalidatePath("/admin");
  // The world reads the same rows, so it has to be invalidated too.
  revalidatePath("/");
}

function text(form: FormData, key: string, max = 2000): string {
  return String(form.get(key) ?? "")
    .slice(0, max)
    .trim();
}

/** Optional text: an empty box means "no value", not an empty string. */
function optional(form: FormData, key: string, max = 2000): string | null {
  const value = text(form, key, max);
  return value === "" ? null : value;
}

function number(form: FormData, key: string, fallback = 0): number {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function contentType(form: FormData, key: string): ContentType {
  const value = text(form, key, 20).toUpperCase();
  return (TYPES as readonly string[]).includes(value)
    ? (value as ContentType)
    : "MEMORY";
}

/** A YYYY-MM-DD from a date input, or null. Rejects anything else. */
function isoDay(form: FormData, key: string): string | null {
  const value = text(form, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function requireSpotId(form: FormData, key = "spotId"): Promise<string> {
  const id = text(form, key, 40);
  if (!UUID.test(id)) throw new Error("Unknown spot.");
  const relationship = await getRelationship();
  const [row] = await db
    .select({ id: spots.id })
    .from(spots)
    .where(and(eq(spots.id, id), eq(spots.relationshipId, relationship.id)));
  if (!row) throw new Error("Unknown spot.");
  return id;
}

// --- relationship -----------------------------------------------------------

export async function updateRelationship(form: FormData) {
  await requireAdmin();
  const relationship = await getRelationship();

  // Clamped rather than rejected: the door question only has to match itself.
  const month = Math.min(12, Math.max(1, Math.round(number(form, "month", 1))));
  const day = Math.min(31, Math.max(1, Math.round(number(form, "day", 1))));

  await db
    .update(relationships)
    .set({ anniversaryMonth: month, anniversaryDay: day, updatedAt: new Date() })
    .where(eq(relationships.id, relationship.id));

  refresh();
}

// --- spots ------------------------------------------------------------------

export async function createSpot(form: FormData) {
  await requireAdmin();
  const relationship = await getRelationship();

  const kind = text(form, "kind", 20).toUpperCase() as SpotKind;
  if (!KINDS.includes(kind)) throw new Error("Unknown kind of spot.");

  const title = text(form, "title", 120) || "something new";

  const [spot] = await db
    .insert(spots)
    .values({
      relationshipId: relationship.id,
      kind,
      title,
      x: number(form, "x"),
      z: number(form, "z"),
      rotation: number(form, "rotation"),
      config: kind === "ARCADE" ? { game: "claw" } : null,
      // Staged by default, so a half-written thing never appears in her world.
      published: false,
    })
    .returning();

  // Non-arcade spots reveal a memory, so give them an empty one to fill in.
  if (kind !== "ARCADE") {
    await db.insert(memories).values({ spotId: spot.id, title, type: "MEMORY" });
  }

  refresh();
}

export async function updateSpot(form: FormData) {
  await requireAdmin();
  const spotId = await requireSpotId(form);

  await db
    .update(spots)
    .set({
      title: text(form, "title", 120) || "something",
      x: number(form, "x"),
      z: number(form, "z"),
      rotation: number(form, "rotation"),
      published: form.get("published") === "on",
    })
    .where(eq(spots.id, spotId));

  refresh();
}

export async function deleteSpot(form: FormData) {
  await requireAdmin();
  const spotId = await requireSpotId(form);
  // Memories, prizes, discoveries and collected items cascade with it.
  await db.delete(spots).where(eq(spots.id, spotId));
  refresh();
}

// --- memories ---------------------------------------------------------------

export async function saveMemory(form: FormData) {
  await requireAdmin();
  const spotId = await requireSpotId(form);

  // A chosen file wins over whatever is typed in the URL box.
  const uploaded = await uploadFromForm(form, "image");

  const values = {
    title: text(form, "title", 160) || "Untitled",
    message: optional(form, "message", 4000),
    mediaUrl: uploaded ?? optional(form, "mediaUrl", 800),
    mediaAlt: optional(form, "mediaAlt", 400),
    memoryDate: isoDay(form, "memoryDate"),
    type: contentType(form, "type"),
  };

  const [existing] = await db
    .select({ id: memories.id })
    .from(memories)
    .where(eq(memories.spotId, spotId));

  if (existing) {
    await db.update(memories).set(values).where(eq(memories.id, existing.id));
  } else {
    await db.insert(memories).values({ spotId, ...values });
  }

  refresh();
}

// --- prizes -----------------------------------------------------------------

export async function createPrize(form: FormData) {
  await requireAdmin();
  const spotId = await requireSpotId(form);

  await db.insert(collectibles).values({
    spotId,
    title: text(form, "title", 160) || "A prize",
    message: optional(form, "message", 4000),
    type: contentType(form, "type"),
  });

  refresh();
}

export async function savePrize(form: FormData) {
  await requireAdmin();
  const relationship = await getRelationship();
  const id = text(form, "prizeId", 40);
  if (!UUID.test(id)) throw new Error("Unknown prize.");

  // The prize has to belong to a spot in this relationship.
  const [owned] = await db
    .select({ id: collectibles.id })
    .from(collectibles)
    .innerJoin(spots, eq(spots.id, collectibles.spotId))
    .where(and(eq(collectibles.id, id), eq(spots.relationshipId, relationship.id)));
  if (!owned) throw new Error("Unknown prize.");

  if (form.get("remove") === "1") {
    await db.delete(collectibles).where(eq(collectibles.id, id));
  } else {
    const uploaded = await uploadFromForm(form, "image");
    await db
      .update(collectibles)
      .set({
        title: text(form, "title", 160) || "A prize",
        message: optional(form, "message", 4000),
        mediaUrl: uploaded ?? optional(form, "mediaUrl", 800),
        mediaAlt: optional(form, "mediaAlt", 400),
        type: contentType(form, "type"),
      })
      .where(eq(collectibles.id, id));
  }

  refresh();
}

// --- progress ---------------------------------------------------------------

/** Wipes what she has found, so the world can be walked fresh. */
export async function resetProgress(form: FormData) {
  await requireAdmin();
  const userId = text(form, "userId", 40);
  if (!UUID.test(userId)) throw new Error("Unknown player.");

  await db.delete(discoveries).where(eq(discoveries.userId, userId));
  await db.delete(collectedItems).where(eq(collectedItems.userId, userId));

  refresh();
}
