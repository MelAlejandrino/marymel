/**
 * Change an account's password.
 *
 *   npm run db:password -- admin@example.com "a better password"
 *
 * The seeded accounts share a placeholder, which is fine on a laptop and not
 * fine anywhere else. SEED_PASSWORD only applies the first time an account is
 * created, so changing it afterwards needs this.
 */
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { hashPassword } from "../auth/password.ts";
import * as s from "./schema.ts";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: npm run db:password -- <email> "<new password>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Use at least 8 characters.");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL!), { schema: s });

const [user] = await db
  .select({ id: s.users.id, role: s.users.role })
  .from(s.users)
  .where(eq(s.users.email, email.toLowerCase()));

if (!user) {
  console.error(`No account for ${email}.`);
  process.exit(1);
}

await db
  .update(s.users)
  .set({ passwordHash: await hashPassword(password) })
  .where(eq(s.users.id, user.id));

console.log(`Password updated for ${email} (${user.role}).`);
