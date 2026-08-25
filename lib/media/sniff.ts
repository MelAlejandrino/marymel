/**
 * What a file actually is, from its first few bytes.
 *
 * The browser-supplied `Content-Type` and the filename are both attacker
 * controlled, so neither is evidence of anything (PLAN §23: file upload
 * validation). The bytes are.
 */

export type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** Largest header we need to look at. */
export const SNIFF_BYTES = 16;

const starts = (bytes: Uint8Array, sig: readonly number[], at = 0) =>
  bytes.length >= at + sig.length && sig.every((b, i) => bytes[at + i] === b);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** The detected image type, or null if these bytes are not an image we accept. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  // JPEG: SOI marker.
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: signature includes CRLF and EOF bytes to catch text-mode corruption.
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // GIF87a / GIF89a.
  if (starts(bytes, ascii("GIF87a")) || starts(bytes, ascii("GIF89a"))) {
    return "image/gif";
  }

  // WebP is a RIFF container: "RIFF" then four size bytes then "WEBP".
  if (starts(bytes, ascii("RIFF")) && starts(bytes, ascii("WEBP"), 8)) {
    return "image/webp";
  }

  return null;
}

/** File extension for a detected type, for the stored filename. */
export const extensionFor = (type: ImageType): string =>
  ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  })[type];
