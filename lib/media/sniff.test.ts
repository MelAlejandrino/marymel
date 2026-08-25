/** Run: node --test */
import assert from "node:assert/strict";

import { extensionFor, sniffImage, SNIFF_BYTES } from "./sniff.ts";

const bytes = (...v: number[]) => new Uint8Array(v);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const join = (...parts: Uint8Array[]) =>
  new Uint8Array(parts.flatMap((p) => [...p]));

// --- the formats we accept --------------------------------------------------
assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10)), "image/jpeg");
assert.equal(
  sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)),
  "image/png",
);
assert.equal(sniffImage(ascii("GIF89a....")), "image/gif");
assert.equal(sniffImage(ascii("GIF87a....")), "image/gif");
// WebP: "RIFF", four size bytes, then "WEBP".
assert.equal(
  sniffImage(join(ascii("RIFF"), bytes(1, 2, 3, 4), ascii("WEBPVP8 "))),
  "image/webp",
);

// --- things that are not images --------------------------------------------
assert.equal(sniffImage(ascii("<!DOCTYPE html><html>")), null, "an HTML page");
assert.equal(sniffImage(ascii("%PDF-1.7")), null, "a PDF");
assert.equal(sniffImage(bytes(0x50, 0x4b, 0x03, 0x04)), null, "a zip");
assert.equal(sniffImage(ascii("#!/bin/sh\nrm -rf /")), null, "a script");
// An SVG is an image, but it can carry script, so it is deliberately refused.
assert.equal(sniffImage(ascii("<svg xmlns=")), null, "SVG must be rejected");

// --- near misses ------------------------------------------------------------
// A prefix that only partly matches must not pass.
assert.equal(sniffImage(bytes(0xff, 0xd8)), null, "truncated JPEG marker");
assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47)), null, "truncated PNG signature");
assert.equal(sniffImage(ascii("GIF")), null);
// RIFF alone is not WebP — it could be a WAV.
assert.equal(sniffImage(join(ascii("RIFF"), bytes(1, 2, 3, 4), ascii("WAVE"))), null);
// The signature has to be at the start, not merely present somewhere.
assert.equal(sniffImage(join(bytes(0, 0), ascii("GIF89a"))), null, "offset signature");

// --- degenerate input -------------------------------------------------------
assert.equal(sniffImage(new Uint8Array()), null, "an empty file");
assert.equal(sniffImage(bytes(0)), null);
// Never throws, whatever it is handed.
for (let n = 0; n < 20; n++) {
  assert.doesNotThrow(() => sniffImage(new Uint8Array(n)));
}

// Reading this many bytes is enough to identify every format above.
assert.ok(SNIFF_BYTES >= 12, "WebP needs at least 12 bytes to identify");

// --- extensions -------------------------------------------------------------
assert.equal(extensionFor("image/jpeg"), "jpg");
assert.equal(extensionFor("image/png"), "png");
assert.equal(extensionFor("image/gif"), "gif");
assert.equal(extensionFor("image/webp"), "webp");

console.log("sniff: all assertions passed");
