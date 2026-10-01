// CIVIC INDIA 2.0 — Data Quality Engine
// Validates, scores, sanitizes, and evaluates incoming records from government platforms.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import type { CanonicalCivicRecord } from "./canonical-model";

export type DataQualityStatus = "VALID" | "WARNING" | "REVIEW" | "REJECTED" | "QUARANTINED";

export interface DataQualityEvaluation {
  score: number; // 0 - 100
  status: DataQualityStatus;
  errors: string[];
  warnings: string[];
  normalizedFields: string[];
  rejectedFields: string[];
  suggestedFix?: string;
}

/** Evaluates the quality of incoming data payload and normalized record */
export function evaluatePayloadQuality(
  systemCode: string,
  rawPayload: Record<string, unknown>,
  normalized: CanonicalCivicRecord
): DataQualityEvaluation {
  let score = 100;
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedFields: string[] = [];
  const rejectedFields: string[] = [];
  let suggestedFix: string | undefined;

  // 1. Mandatory Identifier Check
  if (!normalized.sourceRecordId || normalized.sourceRecordId.trim() === "") {
    score -= 35;
    errors.push("Missing source record ID / complaint identifier");
    rejectedFields.push("sourceRecordId");
  } else {
    normalizedFields.push("sourceRecordId");
  }

  // 2. Geospatial Location Validation
  const { latitude, longitude } = normalized;
  if (latitude === null || latitude === undefined || isNaN(latitude) ||
      longitude === null || longitude === undefined || isNaN(longitude)) {
    score -= 30;
    errors.push("Invalid GPS coordinates: missing or non-numeric");
    rejectedFields.push("coordinates");
  } else if (latitude < 6.0 || latitude > 38.0 || longitude < 68.0 || longitude > 98.0) {
    score -= 25;
    errors.push(`Coordinates (${latitude}, ${longitude}) lie outside India territorial boundaries`);
    rejectedFields.push("coordinates");
  } else {
    normalizedFields.push("latitude", "longitude");
  }

  // 3. Category Validation
  if (!normalized.category || normalized.category === "other") {
    score -= 10;
    warnings.push("Category could not be matched with high confidence; mapped to 'other'");
  } else {
    normalizedFields.push("category");
  }

  // 4. Description Clarity Validation
  if (!normalized.description || normalized.description.trim().length < 5) {
    score -= 20;
    errors.push("Description is empty or too short (< 5 characters) to be actionable");
    rejectedFields.push("description");
  } else if (normalized.description.length < 15) {
    score -= 5;
    warnings.push("Short description; additional field inspection recommended");
    normalizedFields.push("description");
  } else {
    normalizedFields.push("description");
  }

  // 5. Contact / Citizen Format Check
  if (normalized.contact) {
    const digitsOnly = normalized.contact.replace(/\D/g, "");
    if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      score -= 10;
      warnings.push("Contact phone number appears malformed (less than 10 digits)");
    } else {
      normalizedFields.push("contact");
    }
  }

  // 6. Address / Locality
  if (!normalized.address || normalized.address.trim().length === 0) {
    score -= 10;
    warnings.push("Missing localized street/address landmark");
  } else {
    normalizedFields.push("address");
  }

  // Ensure score stays 0..100
  score = Math.max(0, Math.min(100, score));

  // Determine Status
  let status: DataQualityStatus = "VALID";
  if (errors.length >= 2 || score < 40) {
    status = "REJECTED";
    suggestedFix = "Reject record and request source government portal to provide mandatory location & ID.";
  } else if (errors.length === 1 || score < 60) {
    status = "REVIEW";
    suggestedFix = "Queue for municipal officer review to rectify missing landmark or coordinate ambiguity.";
  } else if (warnings.length > 0 || score < 85) {
    status = "WARNING";
    suggestedFix = "Auto-normalized with fallback values. Minor verification recommended.";
  } else {
    status = "VALID";
  }

  return {
    score,
    status,
    errors,
    warnings,
    normalizedFields,
    rejectedFields,
    suggestedFix,
  };
}

/** Record Data Quality Evaluation in Database */
export async function recordDataQualityCheck(opts: {
  systemId?: string;
  sourceRecordId: string;
  correlationId?: string;
  rawPayload: Record<string, unknown>;
  normalized: CanonicalCivicRecord;
  evaluation: DataQualityEvaluation;
}): Promise<any> {
  const result = await db.dataQualityResult.create({
    data: {
      systemId: opts.systemId ?? null,
      sourceRecordId: opts.sourceRecordId,
      correlationId: opts.correlationId ?? null,
      score: opts.evaluation.score,
      status: opts.evaluation.status,
      errors: JSON.stringify(opts.evaluation.errors),
      warnings: JSON.stringify(opts.evaluation.warnings),
      normalizedFields: JSON.stringify(opts.evaluation.normalizedFields),
      rejectedFields: JSON.stringify(opts.evaluation.rejectedFields),
      rawPayload: JSON.stringify(opts.rawPayload),
      normalizedPayload: JSON.stringify(opts.normalized),
      suggestedFix: opts.evaluation.suggestedFix ?? null,
    },
  });

  log.info("data_quality_checked", {
    sourceRecordId: opts.sourceRecordId,
    score: opts.evaluation.score,
    status: opts.evaluation.status,
  });

  return result;
}

/** Get data quality overview and list of inspected records */
export async function getDataQualityMetrics(opts?: { status?: string; limit?: number }) {
  const where = opts?.status ? { status: opts.status } : {};
  const limit = opts?.limit ?? 50;

  const [records, total, validCount, warningCount, reviewCount, rejectedCount, quarantinedCount] = await Promise.all([
    db.dataQualityResult.findMany({
      where,
      orderBy: { checkedAt: "desc" },
      take: limit,
      include: { system: { select: { name: true, code: true } } },
    }),
    db.dataQualityResult.count(),
    db.dataQualityResult.count({ where: { status: "VALID" } }),
    db.dataQualityResult.count({ where: { status: "WARNING" } }),
    db.dataQualityResult.count({ where: { status: "REVIEW" } }),
    db.dataQualityResult.count({ where: { status: "REJECTED" } }),
    db.dataQualityResult.count({ where: { status: "QUARANTINED" } }),
  ]);

  const avgScore = records.length > 0
    ? Math.round(records.reduce((acc, r) => acc + r.score, 0) / records.length)
    : 100;

  return {
    total,
    validCount,
    warningCount,
    reviewCount,
    rejectedCount,
    quarantinedCount,
    avgScore,
    records: records.map((r) => ({
      id: r.id,
      systemName: r.system?.name ?? "Simulated System",
      systemCode: r.system?.code ?? "SYSTEM",
      sourceRecordId: r.sourceRecordId,
      correlationId: r.correlationId,
      score: r.score,
      status: r.status,
      errors: safeJsonParse(r.errors, []),
      warnings: safeJsonParse(r.warnings, []),
      normalizedFields: safeJsonParse(r.normalizedFields, []),
      rejectedFields: safeJsonParse(r.rejectedFields, []),
      suggestedFix: r.suggestedFix,
      rawPayload: safeJsonParse(r.rawPayload, {}),
      normalizedPayload: safeJsonParse(r.normalizedPayload, {}),
      checkedAt: r.checkedAt.toISOString(),
    })),
  };
}

/** Update data quality review status */
export async function updateDataQualityReview(
  id: string,
  newStatus: DataQualityStatus,
  reviewer: string
) {
  return db.dataQualityResult.update({
    where: { id },
    data: {
      status: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date(),
    },
  });
}

function safeJsonParse(val: string, fallback: any) {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}
