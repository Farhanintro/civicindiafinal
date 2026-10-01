// CIVIC INDIA 2.0 — Audit Trail Service
// Immutable audit log for traceability of all system actions.

import "server-only";
import { db } from "@/lib/db";

export interface AuditLogDTO {
  id: string;
  entityType: string;
  entityId: string;
  incidentId: string | null;
  unifiedCaseId: string | null;
  correlationId?: string | null;
  action: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  details: Record<string, unknown>;
  summary: string;
  createdAt: string;
}

/** Write an audit log entry */
export async function writeAuditLog(opts: {
  entityType: string;
  entityId: string;
  incidentId?: string;
  unifiedCaseId?: string;
  correlationId?: string;
  action: string;
  actorType?: string;
  actorId?: string;
  actorName?: string;
  details?: Record<string, unknown>;
  summary: string;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      incidentId: opts.incidentId ?? null,
      unifiedCaseId: opts.unifiedCaseId ?? null,
      correlationId: opts.correlationId ?? null,
      action: opts.action,
      actorType: opts.actorType ?? "SYSTEM",
      actorId: opts.actorId ?? null,
      actorName: opts.actorName ?? null,
      details: JSON.stringify(opts.details ?? {}),
      summary: opts.summary,
    },
  });
}

/** Get audit logs for a specific entity */
export async function getAuditLogs(opts?: {
  entityType?: string;
  entityId?: string;
  incidentId?: string;
  unifiedCaseId?: string;
  limit?: number;
  page?: number;
}): Promise<{ logs: AuditLogDTO[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (opts?.entityType) where.entityType = opts.entityType;
  if (opts?.entityId) where.entityId = opts.entityId;
  if (opts?.incidentId) where.incidentId = opts.incidentId;
  if (opts?.unifiedCaseId) where.unifiedCaseId = opts.unifiedCaseId;

  const limit = opts?.limit ?? 50;
  const page = opts?.page ?? 1;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map(toAuditLogDTO),
    total,
  };
}

/** Get recent system-wide audit logs */
export async function getRecentAuditLogs(limit = 20): Promise<AuditLogDTO[]> {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return logs.map(toAuditLogDTO);
}

function toAuditLogDTO(l: any): AuditLogDTO {
  let details: Record<string, unknown> = {};
  try { details = typeof l.details === "string" ? JSON.parse(l.details) : l.details ?? {}; }
  catch { details = {}; }

  return {
    id: l.id,
    entityType: l.entityType,
    entityId: l.entityId,
    incidentId: l.incidentId,
    unifiedCaseId: l.unifiedCaseId,
    action: l.action,
    actorType: l.actorType,
    actorId: l.actorId,
    actorName: l.actorName,
    details,
    summary: l.summary,
    createdAt: l.createdAt?.toISOString?.() ?? l.createdAt,
  };
}
