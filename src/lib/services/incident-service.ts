// CivicLens — Incident service: the domain core.
// One physical INCIDENT links many citizen REPORTs. Handles creation, duplicate linking,
// explainable priority recompute, and the status workflow (with full history).

import { db } from "@/lib/db";
import { STATUS_TRANSITIONS } from "@/lib/civiclens/constants";
import type {
  CivicAnalysis,
  IncidentDetail,
  IncidentStatus,
  IncidentSummary,
  Priority,
  ReportDTO,
  ReverseGeocodeResult,
  Severity,
} from "@/lib/civiclens/types";
import { assessPriority, severityBand } from "./priority-service";
import { notifyIncidentReporters, notifyUser } from "./notification-service";
import { log } from "./logger";
import type { Report, Incident, AiAnalysis, Category, Department } from "@prisma/client";

// ---------- public ids (INC-1001, REP-0001) ----------

async function nextPublicId(prefix: "INC" | "REP"): Promise<string> {
  const rows =
    prefix === "INC"
      ? await db.incident.findMany({
          where: { publicId: { startsWith: "INC-" } },
          select: { publicId: true },
          take: 500,
          orderBy: { publicId: "desc" },
        })
      : await db.report.findMany({
          where: { publicId: { startsWith: "REP-" } },
          select: { publicId: true },
          take: 500,
          orderBy: { publicId: "desc" },
        });
  let max = prefix === "INC" ? 1000 : 0;
  for (const row of rows) {
    const n = Number(row.publicId.split("-")[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}-${max + 1}`;
}

// ---------- serialization ----------

type IncidentWithRefs = Incident & {
  category?: Category | null;
  department?: Department | null;
};

export function toIncidentSummary(inc: IncidentWithRefs): IncidentSummary {
  return {
    id: inc.id,
    publicId: inc.publicId,
    title: inc.title,
    categoryKey: inc.categoryKey,
    categoryLabel: inc.category?.label,
    severity: inc.severity as Severity,
    severityScore: inc.severityScore,
    priority: inc.priority as Priority,
    priorityScore: inc.priorityScore,
    priorityReasons: safeParseArray(inc.priorityReasons),
    aiConfidence: inc.aiConfidence,
    departmentKey: inc.departmentKey,
    departmentName: inc.department?.name,
    latitude: inc.latitude,
    longitude: inc.longitude,
    address: inc.address,
    city: inc.city,
    district: inc.district,
    state: inc.state,
    status: inc.status as IncidentStatus,
    reportCount: inc.reportCount,
    isDemo: inc.isDemo,
    createdAt: inc.createdAt.toISOString(),
    updatedAt: inc.updatedAt.toISOString(),
    resolvedAt: inc.resolvedAt?.toISOString() ?? null,
    resolutionNote: inc.resolutionNote,
  };
}

export function toReportDTO(
  r: Report & { aiAnalysis?: AiAnalysis | null; user?: { name: string } | null; incident?: { publicId: string } | null },
  includeReporter = false
): ReportDTO {
  const analysis = r.aiAnalysis;
  return {
    id: r.id,
    publicId: r.publicId,
    incidentId: r.incidentId,
    incidentPublicId: r.incident?.publicId ?? null,
    imagePath: r.imagePath,
    description: r.description,
    latitude: r.latitude,
    longitude: r.longitude,
    captureTimestamp: r.captureTimestamp.toISOString(),
    submissionTimestamp: r.submissionTimestamp.toISOString(),
    processingState: r.processingState as ReportDTO["processingState"],
    isDemo: r.isDemo,
    createdAt: r.createdAt.toISOString(),
    ...(includeReporter && r.user ? { reporterName: r.user.name } : {}),
    analysis: analysis ? toCivicAnalysis(analysis) : null,
  };
}

export function toCivicAnalysis(a: AiAnalysis): CivicAnalysis {
  return {
    id: a.id,
    isCivicIssue: a.isCivicIssue,
    categoryKey: a.categoryKey,
    confidence: a.confidence,
    severity: a.severity as Severity,
    severityScore: a.severityScore,
    hazards: safeParseArray(a.hazards),
    departmentKey: a.departmentKey,
    description: a.description,
    reasoning: a.reasoning,
    recommendedAction: a.recommendedAction,
    model: a.model,
    source: a.source as CivicAnalysis["source"],
    processingMs: a.processingMs ?? 0,
    createdAt: a.createdAt.toISOString(),
  };
}

function safeParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const v = JSON.parse(val);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// ---------- priority ----------

export async function recomputePriority(incidentId: string) {
  const incident = await db.incident.findUnique({
    where: { id: incidentId },
    include: { category: true },
  });
  if (!incident || !incident.category) return;

  // hazards from the most recent AI analysis attached to this incident's reports
  const latestAnalysis = await db.aiAnalysis.findFirst({
    where: { report: { incidentId } },
    orderBy: { createdAt: "desc" },
  });
  const hazards = safeParseArray(latestAnalysis?.hazards ?? "[]");

  const result = assessPriority({
    severityScore: incident.severityScore,
    reportCount: incident.reportCount,
    hazards,
    categoryHazardWeight: incident.category.hazardWeight,
    categoryLabel: incident.category.label,
  });

  await db.incident.update({
    where: { id: incidentId },
    data: {
      priorityScore: result.score,
      priority: result.priority,
      priorityReasons: JSON.stringify(result.reasons),
    },
  });
}

// ---------- address ----------

export function formatAddressLine(geo: ReverseGeocodeResult | null, fallbackCity?: string | null): string | null {
  if (!geo) return null;
  const parts = [geo.road, geo.suburb, geo.city, geo.state].filter(Boolean);
  return parts.length > 0 ? parts.slice(0, 3).join(", ") : geo.display.split(",").slice(0, 3).join(", ").trim() || null;
}

export function buildTitle(categoryLabel: string, geo: ReverseGeocodeResult | null, city?: string | null): string {
  const near = geo?.road ?? geo?.suburb ?? geo?.city ?? city ?? "reported location";
  return `${categoryLabel.split(" / ")[0]} near ${near}`;
}

// ---------- create / link ----------

export async function createIncidentFromReport(opts: {
  report: Report;
  analysis: CivicAnalysis | null;
  categoryKey: string;
  geo: ReverseGeocodeResult | null;
  latitude: number;
  longitude: number;
}): Promise<IncidentSummary> {
  const category = await db.category.findUnique({ where: { key: opts.categoryKey } });
  const catLabel = category?.label ?? "Civic Issue";

  const analysis = opts.analysis;
  const severityScore =
    analysis && analysis.severityScore > 0
      ? analysis.severityScore
      : category?.defaultSeverity ?? 5;
  const severity: Severity = analysis && analysis.severity !== "UNKNOWN" ? analysis.severity : severityBand(severityScore);

  const priority = assessPriority({
    severityScore,
    reportCount: 1,
    hazards: safeParseArray(analysis?.hazards),
    categoryHazardWeight: category?.hazardWeight ?? 1,
    categoryLabel: catLabel,
  });

  const publicId = await nextPublicId("INC");
  const incident = await db.incident.create({
    data: {
      publicId,
      categoryKey: opts.categoryKey,
      title: buildTitle(catLabel, opts.geo, opts.geo?.city),
      severity,
      severityScore,
      priority: priority.priority,
      priorityScore: priority.score,
      priorityReasons: JSON.stringify(priority.reasons),
      aiConfidence: analysis?.confidence ?? null,
      aiReasoning: analysis?.reasoning ?? null,
      departmentKey: category?.departmentKey ?? "general",
      latitude: opts.latitude,
      longitude: opts.longitude,
      address: formatAddressLine(opts.geo),
      city: opts.geo?.city ?? null,
      district: opts.geo?.district ?? null,
      state: opts.geo?.state ?? null,
      status: "REPORTED",
      reportCount: 1,
      isDemo: opts.report.isDemo,
    },
  });

  await db.report.update({
    where: { id: opts.report.id },
    data: { incidentId: incident.id, processingState: "COMPLETED" },
  });
  await db.incidentReport.create({
    data: { incidentId: incident.id, reportId: opts.report.id, linkType: "CREATED" },
  });
  await db.statusHistory.create({
    data: {
      incidentId: incident.id,
      fromStatus: null,
      toStatus: "REPORTED",
      actorId: opts.report.userId,
      actorRole: "CITIZEN",
      note: `Report ${opts.report.publicId} submitted with AI analysis (${analysis?.source ?? "manual"})`,
    },
  });

  await notifyUser({
    userId: opts.report.userId,
    incidentId: incident.id,
    type: "REPORT_SUBMITTED",
    title: `Report submitted — ${incident.publicId}`,
    body: `Your ${catLabel.toLowerCase()} report created incident ${incident.publicId}. Priority assessed as ${priority.priority}.`,
  });

  log.info("incident_created", { publicId, category: opts.categoryKey, priority: priority.priority });
  const created = await db.incident.findUnique({
    where: { id: incident.id },
    include: { category: true, department: true },
  });
  return toIncidentSummary(created!);
}

export async function linkReportToIncident(report: Report, incidentId: string): Promise<IncidentSummary> {
  const incident = await db.incident.findUnique({ where: { id: incidentId }, include: { category: true } });
  if (!incident) throw new Error("Incident not found");

  await db.report.update({
    where: { id: report.id },
    data: { incidentId, processingState: "COMPLETED" },
  });
  await db.incidentReport.create({
    data: { incidentId, reportId: report.id, linkType: "LINKED" },
  });
  await db.incident.update({
    where: { id: incidentId },
    data: { reportCount: { increment: 1 } },
  });
  await recomputePriority(incidentId);

  const updated = await db.incident.findUnique({ where: { id: incidentId }, include: { category: true, department: true } });
  const summary = toIncidentSummary(updated!);

  await notifyUser({
    userId: report.userId,
    incidentId,
    type: "LINKED",
    title: `Report linked to ${incident.publicId}`,
    body: `Your report was linked to an existing ${incident.category?.label ?? "civic"} incident (${summary.reportCount} citizen reports). Track it for updates.`,
  });

  log.info("incident_linked", { incident: incident.publicId, report: report.publicId });
  return summary;
}

// ---------- status workflow ----------

export class StatusTransitionError extends Error {}

export async function transitionStatus(opts: {
  incidentId: string;
  toStatus: IncidentStatus;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  note?: string | null;
  extra?: { departmentKey?: string; team?: string; assignedToName?: string; resolutionNote?: string };
}): Promise<IncidentSummary> {
  const incident = await db.incident.findUnique({ where: { id: opts.incidentId } });
  if (!incident) throw new StatusTransitionError("Incident not found");

  const from = incident.status as IncidentStatus;
  const to = opts.toStatus;
  if (from === to) throw new StatusTransitionError(`Incident is already ${to}`);
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new StatusTransitionError(`Invalid transition ${from} → ${to}`);
  }

  const data: Record<string, unknown> = {
    status: to,
    updatedAt: new Date(),
  };
  if (to === "RESOLVED") {
    data.resolvedAt = new Date();
    if (opts.extra?.resolutionNote) data.resolutionNote = opts.extra.resolutionNote;
  }
  if (to === "IN_PROGRESS" && from === "RESOLVED") {
    data.resolvedAt = null; // reopened
  }
  if (to === "REJECTED") {
    data.resolutionNote = opts.note ?? "Rejected after review.";
  }
  if (opts.extra?.departmentKey) {
    data.departmentKey = opts.extra.departmentKey;
  }

  await db.incident.update({ where: { id: opts.incidentId }, data });
  await db.statusHistory.create({
    data: {
      incidentId: opts.incidentId,
      fromStatus: from,
      toStatus: to,
      actorId: opts.actorId,
      actorRole: opts.actorRole,
      note: opts.note ?? null,
    },
  });

  // assignment record when moving to ASSIGNED
  if (to === "ASSIGNED" && opts.extra?.departmentKey) {
    await db.assignment.updateMany({ where: { incidentId: opts.incidentId, active: true }, data: { active: false } });
    await db.assignment.create({
      data: {
        incidentId: opts.incidentId,
        departmentKey: opts.extra.departmentKey,
        team: opts.extra.team ?? null,
        assignedToName: opts.extra.assignedToName ?? null,
        assignedById: opts.actorId,
        note: opts.note ?? null,
      },
    });
  }

  const updated = await db.incident.findUnique({
    where: { id: opts.incidentId },
    include: { category: true, department: true },
  });

  const statusLine: Record<string, string> = {
    VERIFIED: "verified by authorities",
    ASSIGNED: "assigned to a department team",
    IN_PROGRESS: "now in progress",
    RESOLVED: "resolved",
    REJECTED: "rejected after review",
  };
  await notifyIncidentReporters(opts.incidentId, {
    type: to === "RESOLVED" ? "RESOLVED" : "STATUS_CHANGE",
    title: `${updated!.publicId} ${statusLine[to] ?? `moved to ${to}`}`,
    body: `Incident ${updated!.publicId} (${updated!.category?.label ?? "civic issue"}) status: ${from} → ${to}.${opts.note ? ` Note: ${opts.note}` : ""}`,
  });

  log.info("status_change", { incident: updated!.publicId, from, to });
  return toIncidentSummary(updated!);
}

// ---------- detail ----------

export async function getIncidentDetail(publicId: string): Promise<IncidentDetail | null> {
  const inc = await db.incident.findUnique({
    where: { publicId },
    include: {
      category: true,
      department: true,
      reports: {
        orderBy: { createdAt: "desc" },
        include: { aiAnalysis: true, user: { select: { name: true } }, incident: { select: { publicId: true } } },
      },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      assignments: { orderBy: { createdAt: "desc" }, include: { department: true } },
      resolutionEvidences: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!inc) return null;

  const summary = toIncidentSummary(inc);
  return {
    ...summary,
    aiReasoning: inc.aiReasoning,
    reports: inc.reports.map((r) => toReportDTO(r, false)),
    statusHistory: inc.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: (h.fromStatus as IncidentStatus) ?? null,
      toStatus: h.toStatus as IncidentStatus,
      actorName: h.actor?.name ?? null,
      actorRole: h.actorRole,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    assignments: inc.assignments.map((a) => ({
      id: a.id,
      departmentKey: a.departmentKey,
      departmentName: a.department?.name ?? a.departmentKey,
      team: a.team,
      assignedToName: a.assignedToName,
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    })),
    resolutionEvidences: inc.resolutionEvidences.map((e) => ({
      id: e.id,
      imagePath: e.imagePath,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export { nextPublicId };