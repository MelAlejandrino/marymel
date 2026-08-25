/** Run: node lib/auth/auth.test.ts */
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "./password.ts";
import { seal, unseal } from "./token.ts";

const SECRET = "test-secret";
const OTHER = "other-secret";
const now = 1_700_000_000_000;
const future = Math.floor(now / 1000) + 60;

// --- passwords ---
const stored = await hashPassword("correct horse");
assert.ok(stored.startsWith("scrypt$"));
assert.equal(await verifyPassword("correct horse", stored), true);
assert.equal(await verifyPassword("wrong horse", stored), false);
assert.equal(await verifyPassword("", stored), false);
// Same password hashes differently each time (unique salt).
assert.notEqual(stored, await hashPassword("correct horse"));
// Garbage in storage fails closed rather than throwing.
assert.equal(await verifyPassword("x", "not-a-hash"), false);
assert.equal(await verifyPassword("x", "scrypt$$"), false);

// --- session tokens ---
const token = seal({ userId: "u1", role: "PLAYER", exp: future }, SECRET);
assert.deepEqual(unseal(token, SECRET, now), {
  userId: "u1",
  role: "PLAYER",
  exp: future,
});

// A token signed with a different secret is rejected.
assert.equal(unseal(token, OTHER, now), null);

// Tampering with the payload invalidates the signature — the important one:
// this is what stops a PLAYER from editing their cookie into an ADMIN.
const [body, mac] = token.split(".");
const forgedBody = Buffer.from(
  JSON.stringify({ userId: "u1", role: "ADMIN", exp: future }),
).toString("base64url");
assert.equal(unseal(`${forgedBody}.${mac}`, SECRET, now), null);
assert.equal(unseal(`${body}.${mac}x`, SECRET, now), null);
assert.equal(unseal(`${body}.`, SECRET, now), null);
assert.equal(unseal(body, SECRET, now), null);
assert.equal(unseal(undefined, SECRET, now), null);
assert.equal(unseal("", SECRET, now), null);

// Expiry is enforced.
const expired = seal({ userId: "u1", role: "PLAYER", exp: 1 }, SECRET);
assert.equal(unseal(expired, SECRET, now), null);

// A validly signed but structurally wrong payload is rejected, not trusted.
const junkBody = Buffer.from(JSON.stringify({ nope: true })).toString("base64url");
assert.equal(unseal(`${junkBody}.${"x".repeat(43)}`, SECRET, now), null);

console.log("auth: all assertions passed");
