"use client";

// CivicLens — typed client API helpers (all requests use relative paths).

import type {
  AnalyticsDTO,
  AnalyzeResponse,
  IncidentDetail,
  IncidentStatus,
  IncidentSummary,
  NotificationDTO,
  ReportDTO,
  ReverseGeocodeResult,
  SubmitReportRequest,
  SubmitReportResponse,
} from "@/lib/civiclens/types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(err.error ?? `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

// ---------- reports ----------

export async function analyzeReport(input: {
  file?: File | null;
  sampleKey?: string | null;
  idempotencyKey: string;
  latitude: number;
  longitude: number;
  captureTimestamp: string;
  description?: string;
}): Promise<AnalyzeResponse> {
  const form = new FormData();
  if (input.file) form.set("image", input.file);
  if (input.sampleKey) form.set("sampleKey", input.sampleKey);
  form.set("idempotencyKey", input.idempotencyKey);
  form.set("latitude", String(input.latitude));
  form.set("longitude", String(input.longitude));
  form.set("captureTimestamp", input.captureTimestamp);
  if (input.description) form.set("description", input.description);

  const res = await fetch("/api/reports/analyze", { method: "POST", body: form });
  return json<AnalyzeResponse>(res);
}

export async function submitReport(body: SubmitReportRequest): Promise<SubmitReportResponse> {
  const res = await fetch("/api/reports/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await json<SubmitReportResponse & { ok: boolean }>(res);
  return data;
}

export async function fetchMyReports(): Promise<{ reports: (ReportDTO & { incident: IncidentSummary | null })[] }> {
  return json(await fetch("/api/reports/mine"));
}

// ---------- incidents ----------

export interface IncidentQuery {
  q?: string;
  status?: string;
  category?: string;
  priority?: string;
  department?: string;
  city?: string;
  state?: string;
  forMap?: boolean;
  page?: number;
  limit?: number;
  sort?: "recent" | "priority";
}

export async function fetchIncidents(query: IncidentQuery = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "" && v !== false) params.set(k, String(v));
  }
  const res = await fetch(`/api/incidents?${params.toString()}`);
  return json<{
    incidents: IncidentSummary[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>(res);
}

export async function fetchIncident(publicId: string): Promise<{ incident: IncidentDetail }> {
  const res = await fetch(`/api/incidents/${publicId}`);
  if (res.status === 404) throw new ApiError("Incident not found.", 404);
  return json(res);
}

// ---------- admin workflow ----------

export type AdminAction =
  | { action: "verify"; note?: string }
  | { action: "reject"; note?: string }
  | { action: "assign"; departmentKey: string; team?: string; assignedToName?: string; note?: string }
  | { action: "start"; note?: string }
  | { action: "resolve"; resolutionNote?: string }
  | { action: "reopen"; note?: string };

export async function incidentAction(publicId: string, body: AdminAction): Promise<{ incident: IncidentSummary }> {
  const res = await fetch(`/api/incidents/${publicId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return json(res);
}

export async function uploadEvidence(
  publicId: string,
  file: File,
  note?: string
): Promise<{ evidence: { id: string; imagePath: string; note: string | null; createdAt: string } }> {
  const form = new FormData();
  form.set("image", file);
  if (note) form.set("note", note);
  const res = await fetch(`/api/incidents/${publicId}/evidence`, { method: "POST", body: form });
  return json(res);
}

// ---------- misc ----------

export async function fetchAnalytics(): Promise<AnalyticsDTO> {
  return json(await fetch("/api/analytics"));
}

export async function fetchNotifications(): Promise<{ notifications: NotificationDTO[]; unreadCount: number }> {
  return json(await fetch("/api/notifications"));
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    const data = (await res.json()) as { result: ReverseGeocodeResult | null };
    return data.result;
  } catch {
    return null;
  }
}

export async function searchLocations(q: string): Promise<{ display: string; lat: number; lng: number }[]> {
  try {
    const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
    const data = (await res.json()) as { hits: { display: string; lat: number; lng: number }[] };
    return data.hits ?? [];
  } catch {
    return [];
  }
}

// ---------- image compression (before upload & AI analysis) ----------

export async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file; // graceful: send original (server validates size)
  }
}
