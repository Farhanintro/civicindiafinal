// CIVIC INDIA 2.0 — Citizen Consent Management Service
// Enforces granular, purpose-bound citizen data sharing across government systems.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import { writeAuditLog } from "./audit-service";

export interface ConsentCheckResult {
  isPermitted: boolean;
  status: "GRANTED" | "PENDING" | "DENIED" | "EXPIRED" | "REVOKED";
  allowedFields: string[];
  restrictedFields: string[];
  consentId?: string;
  reason: string;
}

export const DEFAULT_DEMO_CONSENTS = [
  {
    citizenId: "MCIT-ALW-0042",
    citizenName: "Aarav Sharma",
    requestingSystem: "PWD_SYSTEM",
    receivingSystem: "MUNICIPAL_PORTAL",
    purpose: "Road defect joint verification and repair work order",
    allowedFields: JSON.stringify(["location", "description", "evidence", "category"]),
    restrictedFields: JSON.stringify(["phone", "email"]),
    status: "GRANTED",
    version: "v1.0",
    consentEvidence: "DIGISIGN_DEMO_HASH_7781a9f02",
  },
  {
    citizenId: "MCIT-ALW-0089",
    citizenName: "Priya Verma",
    requestingSystem: "SANITATION_DEPT",
    receivingSystem: "MUNICIPAL_PORTAL",
    purpose: "Sanitation grievance review and dispatch",
    allowedFields: JSON.stringify(["location", "description", "evidence"]),
    restrictedFields: JSON.stringify(["phone", "email", "address"]),
    status: "GRANTED",
    version: "v1.0",
    consentEvidence: "DIGISIGN_DEMO_HASH_9912b4e88",
  },
];

export async function ensureDefaultConsents(): Promise<void> {
  const count = await db.consent.count();
  if (count === 0) {
    for (const c of DEFAULT_DEMO_CONSENTS) {
      await db.consent.create({
        data: {
          ...c,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    }
    log.info("default_consents_seeded");
  }
}

/** Check whether data fields can be shared with a receiving department/system */
export async function checkConsent(opts: {
  citizenId: string;
  requestingSystem: string;
  receivingSystem: string;
  requestedFields: string[];
}): Promise<ConsentCheckResult> {
  await ensureDefaultConsents();

  const consent = await db.consent.findFirst({
    where: {
      citizenId: opts.citizenId,
      requestingSystem: opts.requestingSystem,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!consent) {
    // Default privacy principle: allow public telemetry (location, description, evidence), block PII
    const safeFields = opts.requestedFields.filter((f) => ["location", "description", "evidence", "category"].includes(f));
    const blockedFields = opts.requestedFields.filter((f) => !["location", "description", "evidence", "category"].includes(f));

    return {
      isPermitted: true,
      status: "GRANTED",
      allowedFields: safeFields,
      restrictedFields: blockedFields,
      reason: "Standard Public Civic Privacy Policy applied: defect telemetry shared; citizen contact masked.",
    };
  }

  // Check if expired, denied, or revoked
  if (consent.status === "REVOKED" || consent.status === "DENIED") {
    return {
      isPermitted: false,
      status: consent.status as any,
      allowedFields: [],
      restrictedFields: opts.requestedFields,
      consentId: consent.id,
      reason: consent.status === "DENIED"
        ? "Citizen explicitly denied consent for this data sharing purpose."
        : "Citizen previously revoked inter-departmental data sharing consent.",
    };
  }

  if (consent.expiresAt && consent.expiresAt < new Date()) {
    return {
      isPermitted: false,
      status: "EXPIRED",
      allowedFields: [],
      restrictedFields: opts.requestedFields,
      consentId: consent.id,
      reason: "Consent duration has expired.",
    };
  }

  let allowed: string[] = [];
  let restricted: string[] = [];
  try {
    allowed = JSON.parse(consent.allowedFields);
    restricted = JSON.parse(consent.restrictedFields);
  } catch {}

  const permitted = opts.requestedFields.filter((f) => allowed.includes(f));
  const blocked = opts.requestedFields.filter((f) => restricted.includes(f) || !allowed.includes(f));

  // Log consent access event
  await db.consentEvent.create({
    data: {
      consentId: consent.id,
      action: "ACCESSED",
      actor: opts.receivingSystem,
      dataFields: JSON.stringify(permitted),
      details: JSON.stringify({
        requested: opts.requestedFields,
        permitted,
        blocked,
      }),
    },
  });

  return {
    isPermitted: permitted.length > 0,
    status: consent.status as any,
    allowedFields: permitted,
    restrictedFields: blocked,
    consentId: consent.id,
    reason: `Consent verified (${consent.version}): ${permitted.length} field(s) allowed, ${blocked.length} field(s) restricted.`,
  };
}

/** Grant citizen consent */
export async function grantConsent(opts: {
  citizenId: string;
  citizenName: string;
  requestingSystem: string;
  receivingSystem: string;
  purpose: string;
  allowedFields: string[];
  restrictedFields?: string[];
  durationDays?: number;
}) {
  const expiresAt = new Date(Date.now() + (opts.durationDays ?? 30) * 24 * 60 * 60 * 1000);

  const consent = await db.consent.create({
    data: {
      citizenId: opts.citizenId,
      citizenName: opts.citizenName,
      requestingSystem: opts.requestingSystem,
      receivingSystem: opts.receivingSystem,
      purpose: opts.purpose,
      allowedFields: JSON.stringify(opts.allowedFields),
      restrictedFields: JSON.stringify(opts.restrictedFields ?? ["phone", "email"]),
      status: "GRANTED",
      version: "v1.0",
      consentEvidence: `DIGISIGN_${Date.now()}_${opts.citizenId.slice(-4)}`,
      expiresAt,
    },
  });

  await db.consentEvent.create({
    data: {
      consentId: consent.id,
      action: "GRANTED",
      actor: opts.citizenName,
      dataFields: JSON.stringify(opts.allowedFields),
      details: JSON.stringify({ purpose: opts.purpose }),
    },
  });

  await writeAuditLog({
    entityType: "CONSENT",
    entityId: consent.id,
    action: "CONSENT_GRANTED",
    actorType: "CITIZEN",
    actorName: opts.citizenName,
    summary: `Citizen granted data sharing consent to ${opts.receivingSystem} for: ${opts.purpose}`,
  });

  return consent;
}

/** Revoke citizen consent */
export async function revokeConsent(consentId: string, citizenName?: string) {
  const updated = await db.consent.update({
    where: { id: consentId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  await db.consentEvent.create({
    data: {
      consentId,
      action: "REVOKED",
      actor: citizenName ?? updated.citizenName,
      dataFields: "[]",
      details: JSON.stringify({ reason: "User triggered revocation" }),
    },
  });

  await writeAuditLog({
    entityType: "CONSENT",
    entityId: consentId,
    action: "CONSENT_REVOKED",
    actorType: "CITIZEN",
    actorName: citizenName ?? updated.citizenName,
    summary: `Citizen revoked data sharing consent with ID: ${consentId}`,
  });

  return updated;
}

/** Restore or re-grant citizen consent */
export async function restoreConsent(consentId: string, citizenName?: string) {
  const updated = await db.consent.update({
    where: { id: consentId },
    data: {
      status: "GRANTED",
      revokedAt: null,
      grantedAt: new Date(),
    },
  });

  await db.consentEvent.create({
    data: {
      consentId,
      action: "GRANTED",
      actor: citizenName ?? updated.citizenName,
      dataFields: updated.allowedFields,
      details: JSON.stringify({ reason: "Consent re-granted by citizen" }),
    },
  });

  await writeAuditLog({
    entityType: "CONSENT",
    entityId: consentId,
    action: "CONSENT_GRANTED",
    actorType: "CITIZEN",
    actorName: citizenName ?? updated.citizenName,
    summary: `Citizen restored data sharing consent with ID: ${consentId}`,
  });

  return updated;
}

/** List all consents */
export async function getConsents(opts?: { citizenId?: string; status?: string }) {
  await ensureDefaultConsents();
  const where: Record<string, unknown> = {};
  if (opts?.citizenId) where.citizenId = opts.citizenId;
  if (opts?.status) where.status = opts.status;

  const consents = await db.consent.findMany({
    where,
    include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  });

  return consents.map((c) => ({
    id: c.id,
    citizenId: c.citizenId,
    citizenName: c.citizenName,
    requestingSystem: c.requestingSystem,
    receivingSystem: c.receivingSystem,
    purpose: c.purpose,
    allowedFields: safeParse(c.allowedFields, []),
    restrictedFields: safeParse(c.restrictedFields, []),
    status: c.status,
    version: c.version,
    consentEvidence: c.consentEvidence,
    grantedAt: c.grantedAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    revokedAt: c.revokedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    events: c.events.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor,
      dataFields: safeParse(e.dataFields, []),
      createdAt: e.createdAt.toISOString(),
    })),
  }));
}

function safeParse(val: string, fallback: any) {
  try { return JSON.parse(val); } catch { return fallback; }
}
