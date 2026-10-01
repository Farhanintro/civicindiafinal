// CIVIC INDIA 2.0 — Event-Driven Architecture & Correlation Tracer
// Generates trace IDs and publishes traceable integration events across all micro-steps.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";

export type CivicEventType =
  | "RECORD_RECEIVED"
  | "DATA_QUALITY_EVALUATED"
  | "DATA_QUALITY_FAILED"
  | "CONSENT_VERIFIED"
  | "CONSENT_REVOKED"
  | "MASTER_ENTITY_RESOLVED"
  | "DUPLICATE_CLUSTERED"
  | "UNIFIED_CASE_CREATED"
  | "CASE_LINKED"
  | "CASE_ROUTED"
  | "WORKFLOW_TRANSITIONED"
  | "SLA_STARTED"
  | "SLA_WARNING"
  | "SLA_BREACHED"
  | "CASE_ESCALATED"
  | "RESOLUTION_SUBMITTED"
  | "RESOLUTION_VERIFIED"
  | "INTEGRATION_RETRY_SCHEDULED"
  | "DEAD_LETTER_QUARANTINED";

export interface IntegrationEventDTO {
  id: string;
  eventType: CivicEventType;
  correlationId: string;
  sourceSystem?: string;
  entityType: string;
  entityId?: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Generate a unique correlation trace ID */
export function generateCorrelationId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `CIVIC-TRACE-${year}-${rand}`;
}

/** Publish and persist an event */
export async function publishCivicEvent(opts: {
  eventType: CivicEventType;
  correlationId: string;
  sourceSystem?: string;
  entityType: string;
  entityId?: string;
  summary: string;
  payload?: Record<string, unknown>;
}): Promise<IntegrationEventDTO> {
  const event = await db.integrationEvent.create({
    data: {
      eventType: opts.eventType,
      correlationId: opts.correlationId,
      sourceSystem: opts.sourceSystem ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      summary: opts.summary,
      payload: JSON.stringify(opts.payload ?? {}),
    },
  });

  log.info("civic_event_published", {
    type: opts.eventType,
    trace: opts.correlationId,
    entity: opts.entityId,
  });

  return {
    id: event.id,
    eventType: event.eventType as CivicEventType,
    correlationId: event.correlationId,
    sourceSystem: event.sourceSystem ?? undefined,
    entityType: event.entityType,
    entityId: event.entityId ?? undefined,
    summary: event.summary,
    payload: safeJsonParse(event.payload, {}),
    createdAt: event.createdAt.toISOString(),
  };
}

/** Query events by correlation trace ID */
export async function getEventsByTrace(correlationId: string): Promise<IntegrationEventDTO[]> {
  const events = await db.integrationEvent.findMany({
    where: { correlationId },
    orderBy: { createdAt: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType as CivicEventType,
    correlationId: e.correlationId,
    sourceSystem: e.sourceSystem ?? undefined,
    entityType: e.entityType,
    entityId: e.entityId ?? undefined,
    summary: e.summary,
    payload: safeJsonParse(e.payload, {}),
    createdAt: e.createdAt.toISOString(),
  }));
}

/** Query recent system events */
export async function getRecentEvents(limit = 50): Promise<IntegrationEventDTO[]> {
  const events = await db.integrationEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType as CivicEventType,
    correlationId: e.correlationId,
    sourceSystem: e.sourceSystem ?? undefined,
    entityType: e.entityType,
    entityId: e.entityId ?? undefined,
    summary: e.summary,
    payload: safeJsonParse(e.payload, {}),
    createdAt: e.createdAt.toISOString(),
  }));
}

function safeJsonParse(val: string, fallback: any) {
  try { return JSON.parse(val); } catch { return fallback; }
}
