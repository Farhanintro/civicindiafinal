// CIVIC INDIA 2.0 — SLA & Escalation Engine
// Configurable SLA deadlines per priority. Tracks breaches and escalation chains.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";

// ── SLA Defaults ──

export const DEFAULT_SLA_CONFIGS = [
  { priority: "P1", maxHours: 24, warningHours: 18, escalationChain: JSON.stringify(["Field Officer", "Department Supervisor", "Department Head"]) },
  { priority: "P2", maxHours: 48, warningHours: 36, escalationChain: JSON.stringify(["Field Officer", "Department Supervisor", "Department Head"]) },
  { priority: "P3", maxHours: 72, warningHours: 60, escalationChain: JSON.stringify(["Field Officer", "Department Supervisor"]) },
  { priority: "P4", maxHours: 168, warningHours: 144, escalationChain: JSON.stringify(["Field Officer"]) },
];

// ── Types ──

export interface SlaTrackerDTO {
  id: string;
  incidentId: string | null;
  unifiedCaseId: string | null;
  priority: string;
  startedAt: string;
  deadlineAt: string;
  warningAt: string;
  status: string;
  escalationLevel: number;
  escalatedAt: string | null;
  resolvedAt: string | null;
  breachedAt: string | null;
  remainingHours: number;
  isOverdue: boolean;
  createdAt: string;
}

// ── Ensure SLA Config ──

export async function ensureSlaConfigs(): Promise<void> {
  for (const config of DEFAULT_SLA_CONFIGS) {
    await db.slaConfig.upsert({
      where: { priority: config.priority },
      update: {},
      create: { ...config, isActive: true },
    });
  }
  log.info("sla_configs_ensured", { count: DEFAULT_SLA_CONFIGS.length });
}

// ── Get SLA Config ──

export async function getSlaConfig(priority: string) {
  return db.slaConfig.findUnique({ where: { priority } });
}

export async function getAllSlaConfigs() {
  return db.slaConfig.findMany({ orderBy: { priority: "asc" } });
}

// ── Create SLA Tracker ──

export async function createSlaTracker(opts: {
  incidentId?: string;
  unifiedCaseId?: string;
  priority: string;
}): Promise<void> {
  const config = await getSlaConfig(opts.priority);
  if (!config || !config.isActive) return;

  const now = new Date();
  const deadlineAt = new Date(now.getTime() + config.maxHours * 60 * 60 * 1000);
  const warningAt = new Date(now.getTime() + config.warningHours * 60 * 60 * 1000);

  await db.slaTracker.create({
    data: {
      incidentId: opts.incidentId ?? null,
      unifiedCaseId: opts.unifiedCaseId ?? null,
      priority: opts.priority,
      startedAt: now,
      deadlineAt,
      warningAt,
      status: "ACTIVE",
    },
  });

  log.info("sla_tracker_created", { priority: opts.priority, deadlineAt: deadlineAt.toISOString() });
}

// ── Check & Update SLA Statuses ──

export async function checkSlaStatuses(): Promise<{
  warnings: number;
  breaches: number;
}> {
  const now = new Date();
  let warnings = 0;
  let breaches = 0;

  // Find active trackers that need status update
  const activeTrackers = await db.slaTracker.findMany({
    where: { status: { in: ["ACTIVE", "WARNING"] } },
  });

  for (const tracker of activeTrackers) {
    if (now >= tracker.deadlineAt && tracker.status !== "BREACHED") {
      // SLA BREACHED
      await db.slaTracker.update({
        where: { id: tracker.id },
        data: {
          status: "BREACHED",
          breachedAt: now,
          escalationLevel: Math.min(tracker.escalationLevel + 1, 2),
          escalatedAt: now,
        },
      });

      // Update related case/incident
      if (tracker.unifiedCaseId) {
        await db.unifiedCase.update({
          where: { id: tracker.unifiedCaseId },
          data: { slaBreached: true },
        });
      }

      await db.auditLog.create({
        data: {
          entityType: tracker.unifiedCaseId ? "UNIFIED_CASE" : "INCIDENT",
          entityId: tracker.unifiedCaseId ?? tracker.incidentId ?? tracker.id,
          incidentId: tracker.incidentId,
          unifiedCaseId: tracker.unifiedCaseId,
          action: "ESCALATED",
          actorType: "SYSTEM",
          summary: `SLA breached for ${tracker.priority} case. Escalated to level ${tracker.escalationLevel + 1}.`,
        },
      });

      breaches++;
    } else if (now >= tracker.warningAt && tracker.status === "ACTIVE") {
      // SLA WARNING
      await db.slaTracker.update({
        where: { id: tracker.id },
        data: { status: "WARNING" },
      });
      warnings++;
    }
  }

  if (warnings > 0 || breaches > 0) {
    log.info("sla_check_complete", { warnings, breaches });
  }

  return { warnings, breaches };
}

// ── Resolve SLA ──

export async function resolveSla(opts: {
  incidentId?: string;
  unifiedCaseId?: string;
}): Promise<void> {
  const where: Record<string, unknown> = {
    status: { in: ["ACTIVE", "WARNING", "BREACHED"] },
  };
  if (opts.incidentId) where.incidentId = opts.incidentId;
  if (opts.unifiedCaseId) where.unifiedCaseId = opts.unifiedCaseId;

  await db.slaTracker.updateMany({
    where,
    data: {
      status: "MET",
      resolvedAt: new Date(),
    },
  });
}

// ── Get SLA Trackers ──

export async function getSlaTrackers(opts?: {
  status?: string;
  priority?: string;
  limit?: number;
}): Promise<SlaTrackerDTO[]> {
  const trackers = await db.slaTracker.findMany({
    where: {
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.priority ? { priority: opts.priority } : {}),
    },
    orderBy: { deadlineAt: "asc" },
    take: opts?.limit ?? 50,
  });

  const now = Date.now();
  return trackers.map((t) => ({
    id: t.id,
    incidentId: t.incidentId,
    unifiedCaseId: t.unifiedCaseId,
    priority: t.priority,
    startedAt: t.startedAt.toISOString(),
    deadlineAt: t.deadlineAt.toISOString(),
    warningAt: t.warningAt.toISOString(),
    status: t.status,
    escalationLevel: t.escalationLevel,
    escalatedAt: t.escalatedAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    breachedAt: t.breachedAt?.toISOString() ?? null,
    remainingHours: Math.max(0, Math.round((t.deadlineAt.getTime() - now) / 3600000 * 10) / 10),
    isOverdue: now > t.deadlineAt.getTime(),
    createdAt: t.createdAt.toISOString(),
  }));
}

// ── SLA Summary Stats ──

export async function getSlaSummary() {
  const [active, warning, breached, met] = await Promise.all([
    db.slaTracker.count({ where: { status: "ACTIVE" } }),
    db.slaTracker.count({ where: { status: "WARNING" } }),
    db.slaTracker.count({ where: { status: "BREACHED" } }),
    db.slaTracker.count({ where: { status: "MET" } }),
  ]);
  return { active, warning, breached, met, total: active + warning + breached + met };
}
