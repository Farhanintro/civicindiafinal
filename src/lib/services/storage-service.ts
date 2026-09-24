// CivicLens — Image storage service.
// Local filesystem adapter for the MVP (public/uploads). The interface is provider-swappable:
// a Supabase Storage / S3 adapter can be dropped in later without touching callers.

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/civiclens/constants";
import { log } from "./logger";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface StoredImage {
  url: string; // public URL path e.g. /uploads/abc.jpg
  hash: string; // sha-256 (future: perceptual hash / anti-spam)
  bytes: number;
}

export function validateImage(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Unsupported file type "${file.type}". Please upload a JPEG, PNG or WebP photo.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  }
  if (file.size < 1024) {
    return "Image appears to be empty or corrupted.";
  }
  return null;
}

export async function storeImage(buffer: Buffer, mimeType: string): Promise<StoredImage> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  log.info("upload_stored", { bytes: buffer.length, type: mimeType });
  return { url: `/uploads/${name}`, hash, bytes: buffer.length };
}
