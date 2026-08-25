import "server-only";

import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db, users } from "../db/index.ts";
import { readSession } from "./session.ts";

/**
 * Every authorization decision goes through here (PLAN §23). The session
 * cookie is signed, but role is re-read from the database rather than trusted
 * from the token — a demoted admin loses access immediately, and a stale
 * cookie for a deleted user resolves to null.
 */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.userId));

  return user ?? null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Gate for the admin area. Role comes from the database, not the cookie, so a
 * player who forges a signed token claiming ADMIN still gets sent away.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/**
 * Who is looking at the world.
 *
 * The world needs no login: she opens the link and walks in. Anyone not signed
 * in is treated as the player account, which is the honest model for a private
 * gift — the world belongs to one person, so an anonymous visitor *is* her, and
 * what she finds is remembered without her ever seeing a password box.
 *
 * NOTE: this makes the world readable by anyone who has the URL. That is the
 * point of it, and it is a deliberate trade. The admin is unaffected: editing
 * still requires signing in, and `requireAdmin` re-reads the role from the
 * database.
 */
export const getViewer = cache(async (): Promise<CurrentUser> => {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;

  // The oldest PLAYER account is the one the world belongs to.
  const [guest] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.role, "PLAYER"))
    .orderBy(asc(users.createdAt))
    .limit(1);

  if (!guest) {
    throw new Error(
      "No player account exists — run `npm run db:seed` to create the world.",
    );
  }
  return guest;
});

/** Whether there is a real session, as opposed to an anonymous visitor. */
export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}
