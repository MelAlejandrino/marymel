"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db, users } from "../db/index.ts";
import { verifyPassword } from "./password.ts";
import { createSession, destroySession } from "./session.ts";

export type LoginState = { error?: string };

/**
 * Compared against when no user matches, so a missing account costs the same
 * scrypt work as a wrong password. Without it, response time leaks which
 * emails are registered.
 */
const DUMMY_HASH =
  "scrypt$4947cb136e04afb38057bc07073c79e8$76446b8dd39a87906d0c14500adb1d64d823bed1d32409c0bfa4d5e4758623c5cf3eaba889b3467d42301b516d89e3d83a0335ae7bf50d982f035713796cb1fe";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Both fields are required." };

  const [user] = await db.select().from(users).where(eq(users.email, email));

  // Same message and same timing either way — never reveal which accounts exist.
  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) return { error: "That email and password don't match." };

  await createSession(user.id, user.role);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
