import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// ponytail: HTTP driver — one round trip per query, no cross-query
// transactions. Nothing here needs them (see collected_items' unique index).
// Swap to drizzle-orm/neon-serverless + Pool if that changes.
export const db = drizzle(neon(url), { schema });

export * from "./schema.ts";
