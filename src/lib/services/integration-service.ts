// CIVIC INDIA 2.0 — Government Integration Hub Service
// Manages connected (simulated) government systems, API health, sync logs,
// and data ingestion. Architectured for real API plug-in later.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";

// ── Government System Types ──

export interface GovernmentSystemDTO {
  id: string;
  code: string;
  name: string;
  type: string;
  department: string | null;
  baseUrl: string | null;
  webhookUrl: string | null;
  status: string;
  isSimulated: boolean;
  lastSyncAt: string | null;
  lastHealthCheck: string | null;
  healthLatencyMs: number | null;
  requestCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationLogDTO {
  id: string;
  systemId: string;
  systemName: string;
  systemCode: string;
  direction: string;
  method: string;
  endpoint: string;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface IntegrationHealthSummary {
  totalSystems: number;
  onlineSystems: number;
  degradedSystems: number;
  offlineSystems: number;
  totalRequests: number;
  failedRequests: number;
  successRate: number;
  avgLatencyMs: number;
  systems: GovernmentSystemDTO[];
}

// ── Default Government Systems ──
// These are seeded as simulated systems to demonstrate the architecture.
// Real APIs are plugged in by updating baseUrl and isSimulated=false.

export const DEFAULT_GOVT_SYSTEMS = [
  {
    code: "MUN_PORTAL",
    name: "Municipal Complaint Portal",
    type: "MUNICIPAL",
    department: "Municipal Corporation",
    baseUrl: null,
    webhookUrl: "/api/integrations/webhook/MUN_PORTAL",
    dataMapping: JSON.stringify({
      complaintId: "sourceComplaintId",
      citizenName: "citizenName",
      issue: "description",
      lat: "latitude",
      lon: "longitude",
      area: "address",
      type: "categoryKey",
      dateReported: "timestamp",
    }),
  },
  {
    code: "STATE_GRIEVANCE",
    name: "State Grievance Redressal Portal",
    type: "STATE",
    department: "Chief Minister's Office",
    baseUrl: null,
    webhookUrl: "/api/integrations/webhook/STATE_GRIEVANCE",
    dataMapping: JSON.stringify({
      grievanceNo: "sourceComplaintId",
      petitionerName: "citizenName",
      grievanceDescription: "description",
      latitude: "latitude",
      longitude: "longitude",
      location: "address",
      category: "categoryKey",
      filingDate: "timestamp",
    }),
  },
  {
    code: "PWD_SYSTEM",
    name: "Public Works Department Portal",
    type: "DEPARTMENT",
    department: "Public Works Department",
    baseUrl: null,
    webhookUrl: "/api/integrations/webhook/PWD_SYSTEM",
    dataMapping: JSON.stringify({
      workOrderId: "sourceComplaintId",
      reporterName: "citizenName",
      issueDescription: "description",
      gpsLat: "latitude",
      gpsLng: "longitude",
      siteLocation: "address",
      issueType: "categoryKey",
      reportDate: "timestamp",
    }),
  },
  {
    code: "SANITATION_DEPT",
    name: "Sanitation Department System",
    type: "DEPARTMENT",
    department: "Sanitation Department",
    baseUrl: null,
    webhookUrl: "/api/integrations/webhook/SANITATION_DEPT",
    dataMapping: JSON.stringify({
      ticketId: "sourceComplaintId",
      complainant: "citizenName",
      details: "description",
      lat: "latitude",
      lng: "longitude",
      ward: "address",
      complaintType: "categoryKey",
      loggedAt: "timestamp",
    }),
  },
  {
    code: "WATER_DEPT",
    name: "Water Supply Department System",
    type: "DEPARTMENT",
    department: "Water Supply Department",
    baseUrl: null,
    webhookUrl: "/api/integrations/webhook/WATER_DEPT",
    dataMapping: JSON.stringify({
      referenceNo: "sourceComplaintId",
      consumerName: "citizenName",
      complaint: "description",
      latitude: "latitude",
      longitude: "longitude",
      area: "address",
      nature: "categoryKey",
      dateLogged: "timestamp",
    }),
  },
];

// ── Service Functions ──

/** Ensure all default government systems exist in the database */
export async function ensureGovernmentSystems(): Promise<void> {
  for (const sys of DEFAULT_GOVT_SYSTEMS) {
    await db.governmentSystem.upsert({
      where: { code: sys.code },
      update: {},
      create: {
        ...sys,
        status: "ONLINE",
        isSimulated: true,
      },
    });
  }
  log.info("integration_systems_ensured", { count: DEFAULT_GOVT_SYSTEMS.length });
}

/** Get all connected government systems */
export async function getGovernmentSystems(): Promise<GovernmentSystemDTO[]> {
  const systems = await db.governmentSystem.findMany({
    orderBy: { createdAt: "asc" },
  });
  return systems.map(toSystemDTO);
}

/** Get system by code */
export async function getSystemByCode(code: string) {
  return db.governmentSystem.findUnique({ where: { code } });
}

/** Get integration health summary */
export async function getIntegrationHealth(): Promise<IntegrationHealthSummary> {
  const systems = await db.governmentSystem.findMany();
  const totalRequests = systems.reduce((s, sys) => s + sys.requestCount, 0);
  const failedRequests = systems.reduce((s, sys) => s + sys.failedCount, 0);

  // Calculate avg latency from recent logs
  const recentLogs = await db.integrationLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { latencyMs: true },
  });
  const latencies = recentLogs.filter((l) => l.latencyMs != null).map((l) => l.latencyMs!);
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  return {
    totalSystems: systems.length,
    onlineSystems: systems.filter((s) => s.status === "ONLINE").length,
    degradedSystems: systems.filter((s) => s.status === "DEGRADED").length,
    offlineSystems: systems.filter((s) => s.status === "OFFLINE" || s.status === "MAINTENANCE").length,
    totalRequests,
    failedRequests,
    successRate: totalRequests > 0 ? Math.round(((totalRequests - failedRequests) / totalRequests) * 10000) / 100 : 100,
    avgLatencyMs,
    systems: systems.map(toSystemDTO),
  };
}

/** Log an integration event */
export async function logIntegration(opts: {
  systemId: string;
  direction: "INBOUND" | "OUTBOUND";
  method: string;
  endpoint: string;
  requestPayload?: string;
  responsePayload?: string;
  statusCode?: number;
  success: boolean;
  errorMessage?: string;
  latencyMs?: number;
}): Promise<void> {
  await db.integrationLog.create({ data: opts });

  // Update system counters
  await db.governmentSystem.update({
    where: { id: opts.systemId },
    data: {
      requestCount: { increment: 1 },
      ...(opts.success ? {} : { failedCount: { increment: 1 } }),
      lastSyncAt: new Date(),
    },
  });
}

/** Get recent integration logs */
export async function getIntegrationLogs(opts?: {
  systemId?: string;
  success?: boolean;
  limit?: number;
}): Promise<IntegrationLogDTO[]> {
  const logs = await db.integrationLog.findMany({
    where: {
      ...(opts?.systemId ? { systemId: opts.systemId } : {}),
      ...(opts?.success !== undefined ? { success: opts.success } : {}),
    },
    include: { system: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });
  return logs.map((l) => ({
    id: l.id,
    systemId: l.systemId,
    systemName: l.system.name,
    systemCode: l.system.code,
    direction: l.direction,
    method: l.method,
    endpoint: l.endpoint,
    statusCode: l.statusCode,
    success: l.success,
    errorMessage: l.errorMessage,
    latencyMs: l.latencyMs,
    createdAt: l.createdAt.toISOString(),
  }));
}

/** Simulate a health check for all systems */
export async function runHealthChecks(): Promise<void> {
  const systems = await db.governmentSystem.findMany();
  for (const sys of systems) {
    // Simulate latency (realistic range: 50-500ms for online systems)
    const latency = sys.status === "ONLINE"
      ? Math.floor(50 + Math.random() * 200)
      : sys.status === "DEGRADED"
        ? Math.floor(300 + Math.random() * 700)
        : null;

    await db.governmentSystem.update({
      where: { id: sys.id },
      data: {
        lastHealthCheck: new Date(),
        healthLatencyMs: latency,
      },
    });

    await logIntegration({
      systemId: sys.id,
      direction: "OUTBOUND",
      method: "GET",
      endpoint: "/health",
      success: sys.status !== "OFFLINE",
      statusCode: sys.status === "OFFLINE" ? 503 : sys.status === "DEGRADED" ? 200 : 200,
      latencyMs: latency ?? undefined,
      errorMessage: sys.status === "OFFLINE" ? "Connection refused" : undefined,
    });
  }
  log.info("health_checks_complete", { count: systems.length });
}

import { runIngestionPipeline, type IngestionResult } from "./ingestion-pipeline";

/** Ingest a complaint from an external government system through the full interoperability pipeline */
export async function ingestExternalComplaint(opts: {
  systemCode: string;
  complaintId?: string;
  data: Record<string, unknown>;
  correlationId?: string;
}): Promise<{ success: boolean; error?: string; result?: IngestionResult }> {
  try {
    const rawData = {
      ...opts.data,
      ...(opts.complaintId ? { complaintId: opts.complaintId, grievanceNo: opts.complaintId, workOrderId: opts.complaintId } : {}),
    };

    const result = await runIngestionPipeline({
      systemCode: opts.systemCode,
      rawData,
      correlationId: opts.correlationId,
    });

    if (!result.success) {
      return { success: false, error: result.error, result };
    }

    return { success: true, result };
  } catch (err) {
    log.error("ingest_external_complaint_failed", { error: String(err) });
    return { success: false, error: String(err) };
  }
}

// ── Serialization ──

function toSystemDTO(sys: {
  id: string; code: string; name: string; type: string;
  department: string | null; baseUrl: string | null; webhookUrl: string | null;
  status: string; isSimulated: boolean; lastSyncAt: Date | null;
  lastHealthCheck: Date | null; healthLatencyMs: number | null;
  requestCount: number; failedCount: number; createdAt: Date; updatedAt: Date;
}): GovernmentSystemDTO {
  return {
    id: sys.id,
    code: sys.code,
    name: sys.name,
    type: sys.type,
    department: sys.department,
    baseUrl: sys.baseUrl,
    webhookUrl: sys.webhookUrl,
    status: sys.status,
    isSimulated: sys.isSimulated,
    lastSyncAt: sys.lastSyncAt?.toISOString() ?? null,
    lastHealthCheck: sys.lastHealthCheck?.toISOString() ?? null,
    healthLatencyMs: sys.healthLatencyMs,
    requestCount: sys.requestCount,
    failedCount: sys.failedCount,
    createdAt: sys.createdAt.toISOString(),
    updatedAt: sys.updatedAt.toISOString(),
  };
}
