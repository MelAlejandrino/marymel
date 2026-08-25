import "server-only";

import { cookies } from "next/headers";

import { seal, unseal, type SessionPayload } from "./token.ts";

const COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type { SessionPayload };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

export async function createSession(userId: string, role: SessionPayload["role"]) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  (await cookies()).set(COOKIE, seal({ userId, role, exp }, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  return unseal((await cookies()).get(COOKIE)?.value, secret());
}
