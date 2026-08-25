import {
  pgTable,
  pgEnum,
  uuid,
  text,
  real,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["ADMIN", "PLAYER"]);

/**
 * What kind of thing is standing in the world. The visual for each lives in
 * `game/world/spots/`; the registry there maps a kind to a component, so
 * adding a new one never means a migration.
 */
export const spotKindEnum = pgEnum("spot_kind", [
  "ARCADE",
  "FRAME",
  "LETTER",
  "KEEPSAKE",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "PHOTO",
  "LETTER",
  "MEMORY",
  "MESSAGE",
  "GIFT",
  "SPECIAL",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("PLAYER"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Still here with chapters gone: the door at the entrance asks when the
 * anniversary is, and the answer is checked against these.
 */
export const relationships = pgTable("relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  anniversaryMonth: integer("anniversary_month").notNull(),
  anniversaryDay: integer("anniversary_day").notNull(),
  relationshipStartDate: date("relationship_start_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Something placed in the world that she can walk up to. This is the whole
 * content model now — there are no chapters and nothing is time-locked; the
 * world is open and things are found by exploring it.
 */
export const spots = pgTable(
  "spots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    relationshipId: uuid("relationship_id")
      .notNull()
      .references(() => relationships.id, { onDelete: "cascade" }),
    kind: spotKindEnum("kind").notNull(),
    /** Shown in the interaction prompt: "Read *the note on the door*". */
    title: text("title").notNull(),
    /** Position on the ground plane, and which way it faces. */
    x: real("x").notNull(),
    z: real("z").notNull(),
    rotation: real("rotation").notNull().default(0),
    /** Per-kind visual and gameplay options; shape is the component's business. */
    config: jsonb("config"),
    /** Unpublished spots are invisible, so content can be staged. */
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("spots_relationship").on(t.relationshipId)],
);

/** What a spot reveals when she reaches it. */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message"),
    /** Object-storage URL. Large media never lives in Postgres. */
    mediaUrl: text("media_url"),
    /** Alt text — relationship content must not be image-only (PLAN §32). */
    mediaAlt: text("media_alt"),
    memoryDate: date("memory_date"),
    type: contentTypeEnum("type").notNull().default("MEMORY"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("memories_spot").on(t.spotId)],
);

/** Prizes inside an arcade cabinet. */
export const collectibles = pgTable(
  "collectibles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: contentTypeEnum("type").notNull().default("MEMORY"),
    message: text("message"),
    mediaUrl: text("media_url"),
    mediaAlt: text("media_alt"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("collectibles_spot").on(t.spotId)],
);

/** Spots she has already found. Replaces the old per-chapter progress. */
export const discoveries = pgTable(
  "discoveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Makes "discover" idempotent: onConflictDoNothing instead of read-then-write.
  (t) => [unique("discoveries_user_spot").on(t.userId, t.spotId)],
);

export const collectedItems = pgTable(
  "collected_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectibleId: uuid("collectible_id")
      .notNull()
      .references(() => collectibles.id, { onDelete: "cascade" }),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("collected_items_user_collectible").on(t.userId, t.collectibleId)],
);

export type User = typeof users.$inferSelect;
export type Relationship = typeof relationships.$inferSelect;
export type Spot = typeof spots.$inferSelect;
export type SpotKind = (typeof spotKindEnum.enumValues)[number];
export type Memory = typeof memories.$inferSelect;
export type Collectible = typeof collectibles.$inferSelect;
