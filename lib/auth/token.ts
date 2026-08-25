import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  userId: string;
  role: "ADMIN" | "PLAYER";
  /** Unix seconds. */
  exp: number;
};

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/**
 * ponytail: HMAC-signed stateless token — no session table, no revocation
 * list. Two users, one device each. Rotate SESSION_SECRET to invalidate
 * everything; add a sessions table if per-device logout ever matters.
 */
export function seal(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function unseal(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const [body, mac, ...rest] = token.split(".");
  if (!body || !mac || rest.length) return null;

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SessionPayload;
    if (typeof payload?.userId !== "string" || typeof payload?.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
