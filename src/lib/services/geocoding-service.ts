// CivicLens — Geocoding service (OpenStreetMap Nominatim).
// Server-side only, cached, with timeouts. All failures degrade gracefully:
// the app falls back to raw coordinates + manual city selection.

import type { ReverseGeocodeResult } from "@/lib/civiclens/types";
import { log } from "./logger";

const USER_AGENT = "CivicLens/1.0 (civic issue reporting prototype; contact: demo@civiclens.in)";
const TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  value: ReverseGeocodeResult | null;
  at: number;
}

const globalForGeo = globalThis as unknown as {
  __civiclens_geoCache: Map<string, CacheEntry>;
};
const cache = (globalForGeo.__civiclens_geoCache ??= new Map<string, CacheEntry>());

function getCached(key: string): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  city_district?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

function mapAddress(display: string, a: NominatimAddress): ReverseGeocodeResult {
  return {
    display,
    road: a.road ?? a.pedestrian,
    suburb: a.suburb ?? a.neighbourhood,
    city: a.city ?? a.town ?? a.village ?? a.city_district,
    district: a.state_district ?? a.county,
    state: a.state,
    country: a.country,
    postcode: a.postcode,
  };
}

/** Reverse geocode coordinates → address. Returns null on any failure (never throws). */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = getCached(key);
  if (cached) return cached.value;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = (await res.json()) as { display_name?: string; address?: NominatimAddress };
    if (!data.display_name || !data.address) throw new Error("no address in response");
    const value = mapAddress(data.display_name, data.address);
    cache.set(key, { value, at: Date.now() });
    log.info("geocode_result", { ok: true, city: value.city ?? null, state: value.state ?? null });
    return value;
  } catch (err) {
    cache.set(key, { value: null, at: Date.now() });
    log.warn("geocode_result", { ok: false, error: String(err).slice(0, 120) });
    return null;
  }
}

export interface ForwardGeocodeHit {
  display: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
}

/** Forward geocode a search string (manual location fallback). Returns [] on failure. */
export async function forwardGeocode(query: string): Promise<ForwardGeocodeHit[]> {
  if (!query.trim()) return [];
  const key = `f:${query.trim().toLowerCase()}`;
  const cached = getCached(key);
  if (cached && Array.isArray(cached.value)) return cached.value as unknown as ForwardGeocodeHit[];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = (await res.json()) as {
      display_name: string;
      lat: string;
      lon: string;
      address?: NominatimAddress;
    }[];
    const hits = data.map((d) => ({
      display: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
      city: d.address?.city ?? d.address?.town ?? d.address?.village,
      state: d.address?.state,
    }));
    cache.set(key, { value: hits as unknown as ReverseGeocodeResult, at: Date.now() });
    return hits;
  } catch (err) {
    log.warn("geocode_result", { ok: false, forward: true, error: String(err).slice(0, 120) });
    return [];
  }
}
