// CIVIC INDIA 2.0 — Exception Handling, Retry & Dead-Letter Service
// Handles external system failures, exponential backoffs, and quarantined payloads.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import { writeAuditLog } from "./audit-service";
import { publishCivicEvent } from "./event-service";

export interface RetryQueueDTO {
  id: string;
  sourceSystemCode: string;
  sourceRecordId: string;
  correlationId: string | null;
  endpoint: string;
  payload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  status: string;
  lastError: string | null;
  nextRetryAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Queue a failed integration request for retry */
export async function queueForRetry(opts: {
  systemId?: string;
  sourceSystemCode: string;
  sourceRecordId: string;
  correlationId?: string;
  endpoint: string;
  payload: Record<string, unknown>;
  error: string;
  maxRetries?: number;
}) {
  const maxRetries = opts.maxRetries ?? 3;
  const nextRetryAt = new Date(Date.now() + 5000); // 5 sec initial backoff

  const queueItem = await db.retryQueue.create({
    data: {
      systemId: opts.systemId ?? null,
      sourceSystemCode: opts.sourceSystemCode,
      sourceRecordId: opts.sourceRecordId,
      correlationId: opts.correlationId ?? null,
      endpoint: opts.endpoint,
      payload: JSON.stringify(opts.payload),
      retryCount: 0,
      maxRetries,
      status: "PENDING",
      lastError: opts.error,
      nextRetryAt,
    },
  });

  if (opts.correlationId) {
    await publishCivicEvent({
      eventType: "INTEGRATION_RETRY_SCHEDULED",
      correlationId: opts.correlationId,
      sourceSystem: opts.sourceSystemCode,
      entityType: "RETRY_QUEUE",
      entityId: queueItem.id,
      summary: `Integration failure queued for automatic retry. Error: ${opts.error.slice(0, 100)}`,
    });
  }

  await writeAuditLog({
    entityType: "INTEGRATION",
    entityId: queueItem.id,
    action: "FAILED",
    actorType: "SYSTEM",
    summary: `Inbound record from ${opts.sourceSystemCode} [${opts.sourceRecordId}] failed and entered retry queue.`,
  });

  log.warn("integration_failure_queued", {
    system: opts.sourceSystemCode,
    record: opts.sourceRecordId,
    error: opts.error,
  });

  return queueItem;
}

/** Move an unrecoverable toxic record to Quarantine / Dead Letter */
export async function quarantineRecord(id: string, reason: string) {
  const updated = await db.retryQueue.update({
    where: { id },
    data: {
      status: "QUARANTINED",
      lastError: `QUARANTINED: ${reason}`,
    },
  });

  if (updated.correlationId) {
    await publishCivicEvent({
      eventType: "DEAD_LETTER_QUARANTINED",
      correlationId: updated.correlationId,
      sourceSystem: updated.sourceSystemCode,
      entityType: "RETRY_QUEUE",
      entityId: id,
      summary: `Record moved to Dead-Letter Quarantine. Reason: ${reason}`,
    });
  }

  await writeAuditLog({
    entityType: "INTEGRATION",
    entityId: id,
    action: "QUARANTINED",
    actorType: "ADMIN",
    summary: `Record from ${updated.sourceSystemCode} [${updated.sourceRecordId}] quarantined to prevent poison-pill crashes.`,
  });

  return updated;
}

/** Get items in retry queue and dead letter */
export async function getIntegrationFailures(opts?: { status?: string; limit?: number }) {
  const where: Record<string, unknown> = {};
  if (opts?.status) where.status = opts.status;

  const items = await db.retryQueue.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
  });

  const [pendingCount, failedCount, deadLetterCount, quarantinedCount] = await Promise.all([
    db.retryQueue.count({ where: { status: "PENDING" } }),
    db.retryQueue.count({ where: { status: "FAILED" } }),
    db.retryQueue.count({ where: { status: "DEAD_LETTER" } }),
    db.retryQueue.count({ where: { status: "QUARANTINED" } }),
  ]);

  return {
    pendingCount,
    failedCount,
    deadLetterCount,
    quarantinedCount,
    items: items.map((i) => ({
      id: i.id,
      sourceSystemCode: i.sourceSystemCode,
      sourceRecordId: i.sourceRecordId,
      correlationId: i.correlationId,
      endpoint: i.endpoint,
      payload: safeJson(i.payload),
      retryCount: i.retryCount,
      maxRetries: i.maxRetries,
      status: i.status,
      lastError: i.lastError,
      nextRetryAt: i.nextRetryAt?.toISOString() ?? null,
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

/** Execute a retry attempt for an item in the queue */
export async function executeManualRetry(id: string): Promise<{ success: boolean; error?: string; result?: any }> {
  const item = await db.retryQueue.findUnique({ where: { id } });
  if (!item) return { success: false, error: "Queue item not found" };

  const { runIngestionPipeline } = await import("./ingestion-pipeline");
  const payload = safeJson(item.payload);

  const newAttempts = item.retryCount + 1;
  const isFinalAttempt = newAttempts >= item.maxRetries;

  try {
    const res = await runIngestionPipeline({
      systemCode: item.sourceSystemCode,
      rawData: payload,
      correlationId: item.correlationId ?? undefined,
    });

    if (res.success) {
      await db.retryQueue.update({
        where: { id },
        data: {
          retryCount: newAttempts,
          status: "RESOLVED",
          resolvedAt: new Date(),
          lastError: null,
        },
      });

      await writeAuditLog({
        entityType: "INTEGRATION",
        entityId: id,
        action: "RETRY_SUCCEEDED",
        actorType: "ADMIN",
        summary: `Manual retry for ${item.sourceSystemCode} [${item.sourceRecordId}] succeeded on attempt ${newAttempts}.`,
      });

      return { success: true, result: res };
    } else {
      const newStatus = isFinalAttempt ? "DEAD_LETTER" : "FAILED";
      await db.retryQueue.update({
        where: { id },
        data: {
          retryCount: newAttempts,
          status: newStatus,
          lastError: res.error || "Retry ingestion failed",
          nextRetryAt: isFinalAttempt ? null : new Date(Date.now() + Math.pow(2, newAttempts) * 5000),
        },
      });

      await writeAuditLog({
        entityType: "INTEGRATION",
        entityId: id,
        action: isFinalAttempt ? "DEAD_LETTER" : "RETRY_FAILED",
        actorType: "SYSTEM",
        summary: `Retry attempt ${newAttempts}/${item.maxRetries} failed: ${res.error}. Status moved to ${newStatus}.`,
      });

      return { success: false, error: res.error };
    }
  } catch (err) {
    const errorMsg = String(err);
    const newStatus = isFinalAttempt ? "DEAD_LETTER" : "FAILED";
    await db.retryQueue.update({
      where: { id },
      data: {
        retryCount: newAttempts,
        status: newStatus,
        lastError: errorMsg,
        nextRetryAt: isFinalAttempt ? null : new Date(Date.now() + Math.pow(2, newAttempts) * 5000),
      },
    });

    return { success: false, error: errorMsg };
  }
}

function safeJson(val: string): Record<string, unknown> {
  try { return JSON.parse(val); } catch { return {}; }
}
