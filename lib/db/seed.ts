/**
 * Idempotent bootstrap. Run: npm run db:seed
 *
 * Placeholder content only — no real names, photos, or messages. Replace it
 * through the admin dashboard rather than by editing this file; the layout
 * itself lives in `seed-content.ts`.
 */
import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { hashPassword } from "../auth/password.ts";
import * as s from "./schema.ts";
import { countFindable, SEED_SPOTS } from "./seed-content.ts";

// Built here rather than imported from ./index.ts, which is server-only.
const db = drizzle(neon(process.env.DATABASE_URL!), { schema: s });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const PLAYER_EMAIL = process.env.SEED_PLAYER_EMAIL ?? "player@example.com";
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "change-me-please";

const ANNIVERSARY = { month: 8, day: 26 };

async function upsertUser(name: string, email: string, role: "ADMIN" | "PLAYER") {
  const [existing] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (existing) return existing;
  const [row] = await db
    .insert(s.users)
    .values({ name, email, role, passwordHash: await hashPassword(DEFAULT_PASSWORD) })
    .returning();
  return row;
}

async function main() {
  const admin = await upsertUser("Admin", ADMIN_EMAIL, "ADMIN");
  const player = await upsertUser("Player", PLAYER_EMAIL, "PLAYER");

  let [relationship] = await db.select().from(s.relationships).limit(1);
  if (!relationship) {
    [relationship] = await db
      .insert(s.relationships)
      .values({
        anniversaryMonth: ANNIVERSARY.month,
        anniversaryDay: ANNIVERSARY.day,
        relationshipStartDate: "2026-08-26",
      })
      .returning();
  }

  let added = 0;
  for (const seed of SEED_SPOTS) {
    // Keyed on title: re-running must not duplicate the world.
    const [existing] = await db
      .select({ id: s.spots.id })
      .from(s.spots)
      .where(
        and(
          eq(s.spots.relationshipId, relationship.id),
          eq(s.spots.title, seed.title),
        ),
      );
    if (existing) continue;

    const [spot] = await db
      .insert(s.spots)
      .values({
        relationshipId: relationship.id,
        kind: seed.kind,
        title: seed.title,
        x: seed.x,
        z: seed.z,
        rotation: seed.rotation ?? 0,
        config: seed.config ?? null,
      })
      .returning();
    added++;

    if (seed.memory) {
      await db.insert(s.memories).values({
        spotId: spot.id,
        title: seed.memory.title,
        message: seed.memory.message,
        memoryDate: seed.memory.memoryDate ?? null,
        type: seed.memory.type,
      });
    }

    if (seed.prizes?.length) {
      await db.insert(s.collectibles).values(
        seed.prizes.map((prize) => ({
          spotId: spot.id,
          title: prize.title,
          message: prize.message,
          type: prize.type,
        })),
      );
    }
  }

  console.log(
    [
      `relationship ${relationship.id} (anniversary ${ANNIVERSARY.month}/${ANNIVERSARY.day})`,
      `admin  ${admin.email}`,
      `player ${player.email}`,
      `spots  ${added} added, ${SEED_SPOTS.length} defined`,
      `things to find: ${countFindable()}`,
      "",
      DEFAULT_PASSWORD === "change-me-please"
        ? "Both accounts use the default password 'change-me-please'. Change it before this leaves your machine."
        : "Passwords set from SEED_PASSWORD.",
    ].join("\n"),
  );
}

await main();
