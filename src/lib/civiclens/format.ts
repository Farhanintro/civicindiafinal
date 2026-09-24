"use client";

// CivicLens — display formatting helpers.

import { formatDistanceToNowStrict } from "date-fns";

export function timeAgo(iso: string): string {
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function locationLine(inc: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const parts = [inc.address, inc.city, inc.state].filter(Boolean);
  if (parts.length === 0) return "Location unavailable";
  return parts.join(", ").replace(/,\s*,/g, ",");
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
