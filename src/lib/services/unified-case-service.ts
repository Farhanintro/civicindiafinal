// CIVIC INDIA 2.0 — Unified Case Service
// Core interoperability layer: creates unified civic cases that aggregate
// complaints from multiple government systems into one actionable case.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import { assessPriority } from "./priority-service";

// ── Types ──

export interface UnifiedCaseDTO {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  categoryKey: string | null;
  severity: string;
  priority: string;
  priorityScore: number;
  priorityReasons: string[];
  departmentKey: string | null;
  departmentReason: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  status: string;
  sourceCount: number;
  complaintCount: number;
  matchConfidence: number | null;
  matchReasons: string[];
  isRecurring: boolean;
  recurrenceCount: number;
  slaDeadline: string | null;
  slaBreached: boolean;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  links: UnifiedCaseLinkDTO[];
}

export interface UnifiedCaseLinkDTO {
  id: string;
  sourceSystemName: string | null;
  sourceSystemCode: string | null;
  sourceComplaintId: string;
  incidentPublicId: string | null;
  linkType: string;
  matchConfidence: number | null;
  matchReasons: string[];
  createdAt: string;
}

// ── Case ID Generation ──

async function nextCaseId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CIVIC-${year}-`;
  const latest = await db.unifiedCase.findFirst({
    where: { caseId: { startsWith: prefix } },
    orderBy: { caseId: "desc" },
    select: { caseId: true },
  });
  const lastNum = latest ? parseInt(latest.caseId.split("-")[2], 10) : 0;
  return `${prefix}${String(lastNum + 1).padStart(6, "0")}`;
}

// ── Create Unified Case ──

export async function createUnifiedCase(opts: {
  title: string;
  description?: string;
  categoryKey?: string;
  severity?: string;
  departmentKey?: string;
  departmentReason?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  sourceComplaints: {
    sourceSystemCode?: string;
    sourceComplaintId: string;
    incidentId?: string;
    linkType?: string;
    matchConfidence?: number;
    matchReasons?: string[];
    citizenName?: string;
    citizenContact?: string;
    originalData?: Record<string, unknown>;
  }[];
}): Promise<UnifiedCaseDTO> {
  const caseId = await nextCaseId();

  // Calculate priority
  const category = opts.categoryKey
    ? await db.category.findUnique({ where: { key: opts.categoryKey } })
    : null;
  const priorityResult = assessPriority({
    severityScore: opts.severity === "CRITICAL" ? 9 : opts.severity === "HIGH" ? 7 : opts.severity === "MEDIUM" ? 5 : 3,
    reportCount: opts.sourceComplaints.length,
    categoryHazardWeight: category?.hazardWeight ?? 1,
    categoryLabel: category?.label ?? "Civic Issue",
  });

  // Count unique source systems
  const uniqueSystems = new Set(
    opts.sourceComplaints.map((c) => c.sourceSystemCode).filter(Boolean)
  );

  const uc = await db.unifiedCase.create({
    data: {
      caseId,
      title: opts.title,
      description: opts.description ?? null,
      categoryKey: opts.categoryKey ?? null,
      severity: opts.severity ?? "MEDIUM",
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      priorityReasons: JSON.stringify(priorityResult.reasons),
      departmentKey: opts.departmentKey ?? null,
      departmentReason: opts.departmentReason ?? null,
      latitude: opts.latitude ?? null,
      longitude: opts.longitude ?? null,
      address: opts.address ?? null,
      city: opts.city ?? null,
      district: opts.district ?? null,
      state: opts.state ?? null,
      sourceCount: Math.max(uniqueSystems.size, 1),
      complaintCount: opts.sourceComplaints.length,
    },
  });

  // Create links for each source complaint
  for (const complaint of opts.sourceComplaints) {
    const system = complaint.sourceSystemCode
      ? await db.governmentSystem.findUnique({ where: { code: complaint.sourceSystemCode } })
      : null;

    await db.unifiedCaseLink.create({
      data: {
        unifiedCaseId: uc.id,
        sourceSystemId: system?.id ?? null,
        sourceComplaintId: complaint.sourceComplaintId,
        incidentId: complaint.incidentId ?? null,
        linkType: complaint.linkType ?? "PRIMARY",
        matchConfidence: complaint.matchConfidence ?? null,
        matchReasons: JSON.stringify(complaint.matchReasons ?? []),
        citizenName: complaint.citizenName ?? null,
        citizenContact: complaint.citizenContact ?? null,
        originalData: JSON.stringify(complaint.originalData ?? {}),
      },
    });
  }

  // Create audit log entry
  await db.auditLog.create({
    data: {
      entityType: "UNIFIED_CASE",
      entityId: uc.id,
      unifiedCaseId: uc.id,
      action: "CREATED",
      actorType: "SYSTEM",
      summary: `Unified case ${caseId} created with ${opts.sourceComplaints.length} linked complaint(s) from ${uniqueSystems.size || 1} source system(s).`,
      details: JSON.stringify({
        sourceCount: uniqueSystems.size || 1,
        complaintCount: opts.sourceComplaints.length,
        priority: priorityResult.priority,
      }),
    },
  });

  log.info("unified_case_created", { caseId, complaints: opts.sourceComplaints.length });

  return getUnifiedCase(uc.id) as Promise<UnifiedCaseDTO>;
}

// ── Link additional complaint to existing case ──

export async function linkComplaintToCase(opts: {
  unifiedCaseId: string;
  sourceSystemCode?: string;
  sourceComplaintId: string;
  incidentId?: string;
  linkType?: string;
  matchConfidence?: number;
  matchReasons?: string[];
  citizenName?: string;
  citizenContact?: string;
  originalData?: Record<string, unknown>;
}): Promise<void> {
  const system = opts.sourceSystemCode
    ? await db.governmentSystem.findUnique({ where: { code: opts.sourceSystemCode } })
    : null;

  await db.unifiedCaseLink.create({
    data: {
      unifiedCaseId: opts.unifiedCaseId,
      sourceSystemId: system?.id ?? null,
      sourceComplaintId: opts.sourceComplaintId,
      incidentId: opts.incidentId ?? null,
      linkType: opts.linkType ?? "DUPLICATE",
      matchConfidence: opts.matchConfidence ?? null,
      matchReasons: JSON.stringify(opts.matchReasons ?? []),
      citizenName: opts.citizenName ?? null,
      citizenContact: opts.citizenContact ?? null,
      originalData: JSON.stringify(opts.originalData ?? {}),
    },
  });

  // Update counts
  const links = await db.unifiedCaseLink.findMany({
    where: { unifiedCaseId: opts.unifiedCaseId },
    include: { sourceSystem: true },
  });
  const uniqueSystems = new Set(links.map((l) => l.sourceSystemId).filter(Boolean));

  await db.unifiedCase.update({
    where: { id: opts.unifiedCaseId },
    data: {
      complaintCount: links.length,
      sourceCount: Math.max(uniqueSystems.size, 1),
      matchConfidence: opts.matchConfidence ?? undefined,
      matchReasons: opts.matchReasons ? JSON.stringify(opts.matchReasons) : undefined,
    },
  });

  await db.auditLog.create({
    data: {
      entityType: "UNIFIED_CASE",
      entityId: opts.unifiedCaseId,
      unifiedCaseId: opts.unifiedCaseId,
      action: "LINKED",
      actorType: opts.matchConfidence ? "AI" : "SYSTEM",
      summary: `Complaint ${opts.sourceComplaintId} linked as ${opts.linkType ?? "DUPLICATE"} (confidence: ${opts.matchConfidence ?? "N/A"}).`,
    },
  });
}

// ── Fetch Cases ──

export async function getUnifiedCases(opts?: {
  status?: string;
  departmentKey?: string;
  priority?: string;
  slaBreached?: boolean;
  limit?: number;
  page?: number;
}): Promise<{ cases: UnifiedCaseDTO[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;
  if (opts?.departmentKey) where.departmentKey = opts.departmentKey;
  if (opts?.priority) where.priority = opts.priority;
  if (opts?.slaBreached !== undefined) where.slaBreached = opts.slaBreached;

  const limit = opts?.limit ?? 20;
  const page = opts?.page ?? 1;

  const [cases, total] = await Promise.all([
    db.unifiedCase.findMany({
      where,
      include: {
        links: {
          include: {
            sourceSystem: { select: { name: true, code: true } },
            incident: { select: { publicId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    db.unifiedCase.count({ where }),
  ]);

  return {
    cases: cases.map(toUnifiedCaseDTO),
    total,
  };
}

export async function getUnifiedCase(idOrCaseId: string): Promise<UnifiedCaseDTO | null> {
  const uc = await db.unifiedCase.findFirst({
    where: {
      OR: [{ id: idOrCaseId }, { caseId: idOrCaseId }],
    },
    include: {
      links: {
        include: {
          sourceSystem: { select: { name: true, code: true } },
          incident: { select: { publicId: true } },
        },
      },
    },
  });
  return uc ? toUnifiedCaseDTO(uc) : null;
}

// ── Update Case Status ──

export async function updateCaseStatus(caseId: string, status: string, note?: string): Promise<void> {
  const data: Record<string, unknown> = { status };
  if (status === "RESOLVED") data.resolvedAt = new Date();
  if (status === "CLOSED") data.closedAt = new Date();

  await db.unifiedCase.update({ where: { id: caseId }, data });
  await db.auditLog.create({
    data: {
      entityType: "UNIFIED_CASE",
      entityId: caseId,
      unifiedCaseId: caseId,
      action: "UPDATED",
      actorType: "ADMIN",
      summary: `Case status changed to ${status}.${note ? ` Note: ${note}` : ""}`,
    },
  });
}

// ── Serialization ──

function safeParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try { const v = JSON.parse(val); return Array.isArray(v) ? v.map(String) : []; }
    catch { return []; }
  }
  return [];
}

function toUnifiedCaseDTO(uc: any): UnifiedCaseDTO {
  return {
    id: uc.id,
    caseId: uc.caseId,
    title: uc.title,
    description: uc.description,
    categoryKey: uc.categoryKey,
    severity: uc.severity,
    priority: uc.priority,
    priorityScore: uc.priorityScore,
    priorityReasons: safeParseArray(uc.priorityReasons),
    departmentKey: uc.departmentKey,
    departmentReason: uc.departmentReason,
    latitude: uc.latitude,
    longitude: uc.longitude,
    address: uc.address,
    city: uc.city,
    district: uc.district,
    state: uc.state,
    status: uc.status,
    sourceCount: uc.sourceCount,
    complaintCount: uc.complaintCount,
    matchConfidence: uc.matchConfidence,
    matchReasons: safeParseArray(uc.matchReasons),
    isRecurring: uc.isRecurring,
    recurrenceCount: uc.recurrenceCount,
    slaDeadline: uc.slaDeadline?.toISOString?.() ?? uc.slaDeadline ?? null,
    slaBreached: uc.slaBreached,
    resolvedAt: uc.resolvedAt?.toISOString?.() ?? null,
    closedAt: uc.closedAt?.toISOString?.() ?? null,
    createdAt: uc.createdAt?.toISOString?.() ?? uc.createdAt,
    updatedAt: uc.updatedAt?.toISOString?.() ?? uc.updatedAt,
    links: (uc.links ?? []).map((l: any) => ({
      id: l.id,
      sourceSystemName: l.sourceSystem?.name ?? null,
      sourceSystemCode: l.sourceSystem?.code ?? null,
      sourceComplaintId: l.sourceComplaintId,
      incidentPublicId: l.incident?.publicId ?? null,
      linkType: l.linkType,
      matchConfidence: l.matchConfidence,
      matchReasons: safeParseArray(l.matchReasons),
      createdAt: l.createdAt?.toISOString?.() ?? l.createdAt,
    })),
  };
}
