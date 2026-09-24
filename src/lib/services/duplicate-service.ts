// CivicLens — Duplicate detection service.
// MVP: geographic distance + category similarity + active status + time window.
// Future: image embeddings / perceptual hashing / geospatial clustering / vector DB
// (interface kept stable so implementations can be swapped).

import { db } from "@/lib/db";
import { haversineMeters } from "@/lib/civiclens/geo";
import {
  DUPLICATE_RADIUS_METERS,
  DUPLICATE_TIME_WINDOW_DAYS,
  RELATED_CATEGORIES,
} from "@/lib/civiclens/constants";
import type { DuplicateCandidate, IncidentStatus } from "@/lib/civiclens/types";
import { log } from "./logger";

const ACTIVE_STATUSES: IncidentStatus[] = ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"];

export async function findDuplicateCandidates(
  latitude: number,
  longitude: number,
  categoryKey: string
): Promise<DuplicateCandidate[]> {
  try {
    const since = new Date(Date.now() - DUPLICATE_TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const similarKeys = [categoryKey, ...(RELATED_CATEGORIES[categoryKey] ?? [])];

    const incidents = await db.incident.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        categoryKey: { in: similarKeys },
        createdAt: { gte: since },
      },
      include: { category: true },
      take: 500, // guard-rail; future: PostGIS radius query
    });

    const candidates: DuplicateCandidate[] = incidents
      .map((inc) => ({
        incident: inc,
        distanceMeters: haversineMeters(latitude, longitude, inc.latitude, inc.longitude),
      }))
      .filter(({ distanceMeters }) => distanceMeters <= DUPLICATE_RADIUS_METERS)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3)
      .map(({ incident, distanceMeters }) => ({
        publicId: incident.publicId,
        categoryKey: incident.categoryKey,
        categoryLabel: incident.category.label,
        priority: incident.priority as DuplicateCandidate["priority"],
        status: incident.status as IncidentStatus,
        reportCount: incident.reportCount,
        distanceMeters: Math.round(distanceMeters),
        address: incident.address,
        city: incident.city,
        ageHours: Math.max(1, Math.round((Date.now() - incident.createdAt.getTime()) / 36e5)),
      }));

    if (candidates.length > 0) {
      log.info("duplicate_found", {
        count: candidates.length,
        nearestMeters: candidates[0].distanceMeters,
        categoryKey,
      });
    } else {
      log.info("duplicate_none", { categoryKey });
    }
    return candidates;
  } catch (err) {
    log.error("duplicate_found", { error: String(err) });
    return [];
  }
}
