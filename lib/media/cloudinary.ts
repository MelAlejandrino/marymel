import "server-only";

import { createHash } from "node:crypto";

import { extensionFor, sniffImage, type ImageType } from "./sniff.ts";

/**
 * Uploads a photo to Cloudinary and hands back a URL the game can use.
 *
 * ponytail: signed upload with `fetch`, no SDK. Cloudinary's REST API wants a
 * SHA-1 of the sorted parameters plus the secret, which is four lines — the
 * official package brings a large dependency for a single call.
 *
 * Nothing here trusts the browser: the declared content type and the filename
 * are both attacker controlled, so the bytes are sniffed and the extension is
 * chosen from what they actually are.
 */

/**
 * Kept under the server-action body limit in `next.config.ts`, which is in turn
 * capped by Vercel at 4.5MB per request. Rejecting a too-large photo here gives
 * a sentence you can read; letting it through gives an opaque 413.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 - 256 * 1024;

export type UploadResult = { url: string; type: ImageType; bytes: number };

export class UploadError extends Error {}

function credentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new UploadError(
      "Photo upload is not configured. Add CLOUDINARY_CLOUD_NAME, " +
        "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env, then restart " +
        "the dev server.",
    );
  }
  return { cloudName, apiKey, apiSecret };
}

/**
 * Cloudinary signs the parameters that are being sent, sorted by key, joined
 * like a query string, with the secret appended.
 */
function sign(params: Record<string, string>, apiSecret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(canonical + apiSecret)
    .digest("hex");
}

/**
 * Validate and store one image. Returns null when no file was actually chosen,
 * so a form that only edits text does not have to care.
 */
export async function uploadImage(
  file: File | null,
  folder = "marymel",
): Promise<UploadResult | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `That photo is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ` +
        `${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)}MB — the hosting caps how ` +
        `much can be sent in one request. Shrink it, or screenshot it.`,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) {
    throw new UploadError(
      "That file is not a JPEG, PNG, GIF or WebP image. (SVG is not accepted: " +
        "it can carry scripts.)",
    );
  }

  const { cloudName, apiKey, apiSecret } = credentials();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = { folder, timestamp };

  const body = new FormData();
  // Re-wrapped from the sniffed bytes with the type we detected, so nothing the
  // browser claimed about the file is passed along.
  body.set(
    "file",
    new Blob([bytes as unknown as BlobPart], { type }),
    `upload.${extensionFor(type)}`,
  );
  body.set("api_key", apiKey);
  body.set("folder", folder);
  body.set("timestamp", timestamp);
  body.set("signature", sign(signed, apiSecret));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new UploadError(
      `Cloudinary refused the upload (${response.status}). ${detail.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as { secure_url?: string };
  if (!json.secure_url) {
    throw new UploadError("Cloudinary did not return a URL for that photo.");
  }

  return { url: json.secure_url, type, bytes: file.size };
}

/** Pull a file out of a form and upload it, if one was chosen. */
export async function uploadFromForm(
  form: FormData,
  field: string,
): Promise<string | null> {
  const value = form.get(field);
  if (!(value instanceof File)) return null;
  const result = await uploadImage(value);
  return result?.url ?? null;
}
