// CivicLens — Image storage service (provider-swappable).
//
// • Supabase Storage adapter — ACTIVE in production when SUPABASE_URL +
//   SUPABASE_SERVICE_ROLE_KEY are set. Images live in a Supabase Storage bucket;
//   the database stores the public https URL.
// • Local filesystem adapter — fallback for offline dev (public/uploads).
//
// The interface (validateImage + storeImage) is intentionally small so callers
// (reports/analyze, incidents/evidence) never change when the provider changes.
import "server-only";

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/civiclens/constants";
import { log } from "./logger";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface StoredImage {
  url: string; // public URL — Supabase https URL, or local /uploads/... path
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

// ---------- Supabase Storage ----------

interface SupabaseConfig {
  url: string;
  key: string;
  bucket: string;
}

function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "civiclens-uploads" };
}

/** True when images should be stored in Supabase Storage (production). */
export function usingSupabaseStorage(): boolean {
  return supabaseConfig() !== null;
}

async function uploadToSupabase(
  buffer: Buffer,
  mimeType: string,
  prefix: string
): Promise<StoredImage> {
  const cfg = supabaseConfig()!;
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const day = new Date().toISOString().slice(0, 10); // yyyy-mm-dd folder
  const name = `${prefix}/${day}/${randomUUID()}.${ext}`;

  const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": mimeType,
      "x-upsert": "false",
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    throw new Error(
      `Supabase Storage upload failed (HTTP ${res.status}). Check SUPABASE_URL, ` +
        `SUPABASE_SERVICE_ROLE_KEY and that the public bucket "${cfg.bucket}" exists. ${detail}`
    );
  }

  const hash = createHash("sha256").update(buffer).digest("hex");
  return {
    url: `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${name}`,
    hash,
    bytes: buffer.length,
  };
}

// ---------- Local filesystem (offline dev fallback) ----------

async function storeLocal(buffer: Buffer, mimeType: string): Promise<StoredImage> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  return { url: `/uploads/${name}`, hash, bytes: buffer.length };
}

// ---------- Public API ----------

/**
 * Store an image and return its public URL.
 * @param prefix bucket folder for the upload — "reports" (citizen photos) or "evidence" (resolution photos)
 */
export async function storeImage(
  buffer: Buffer,
  mimeType: string,
  prefix: "reports" | "evidence" = "reports"
): Promise<StoredImage> {
  const cfg = supabaseConfig();
  if (cfg) {
    const stored = await uploadToSupabase(buffer, mimeType, prefix);
    log.info("upload_stored", { provider: "supabase", bucket: cfg.bucket, bytes: stored.bytes, type: mimeType });
    return stored;
  }
  const stored = await storeLocal(buffer, mimeType);
  log.info("upload_stored", { provider: "local", bytes: stored.bytes, type: mimeType });
  return stored;
}
