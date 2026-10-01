// CIVIC INDIA 2.0 — Workflow Orchestration Engine
// Manages the state machine and progression of Unified Civic Cases.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import { writeAuditLog } from "./audit-service";
import { publishCivicEvent } from "./event-service";

export type WorkflowState =
  | "CASE_CREATED"
  | "AI_VALIDATION"
  | "DEPARTMENT_ASSIGNMENT"
  | "OFFICER_REVIEW"
  | "IN_PROGRESS"
  | "RESOLUTION_SUBMITTED"
  | "VERIFICATION"
  | "RESOLVED"
  | "ESCALATED";

export interface WorkflowTransitionRecord {
  fromState: string;
  toState: string;
  actorRole: string;
  actorName: string;
  note?: string;
  timestamp: string;
}

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CASE_CREATED: ["AI_VALIDATION", "DEPARTMENT_ASSIGNMENT"],
  AI_VALIDATION: ["DEPARTMENT_ASSIGNMENT", "ESCALATED"],
  DEPARTMENT_ASSIGNMENT: ["OFFICER_REVIEW", "IN_PROGRESS", "ESCALATED"],
  OFFICER_REVIEW: ["IN_PROGRESS", "ESCALATED"],
  IN_PROGRESS: ["RESOLUTION_SUBMITTED", "ESCALATED"],
  RESOLUTION_SUBMITTED: ["VERIFICATION", "IN_PROGRESS"],
  VERIFICATION: ["RESOLVED", "IN_PROGRESS"],
  RESOLVED: ["IN_PROGRESS"], // Re-opened if citizen disputes
  ESCALATED: ["IN_PROGRESS", "DEPARTMENT_ASSIGNMENT"],
};

/** Initialize workflow for a unified case */
export async function initializeCaseWorkflow(opts: {
  unifiedCaseId: string;
  departmentKey?: string;
  slaTargetHours?: number;
  correlationId?: string;
}) {
  const instance = await db.workflowInstance.create({
    data: {
      unifiedCaseId: opts.unifiedCaseId,
      currentState: "CASE_CREATED",
      assignedRole: "OFFICER",
      assignedDept: opts.departmentKey ?? "roads",
      slaTargetHours: opts.slaTargetHours ?? 24,
      history: JSON.stringify([
        {
          fromState: "NONE",
          toState: "CASE_CREATED",
          actorRole: "SYSTEM",
          actorName: "Civic Ingestion Pipeline",
          note: "Workflow initialized automatically upon case creation.",
          timestamp: new Date().toISOString(),
        },
      ]),
    },
  });

  return instance;
}

/** Transition case workflow state */
export async function transitionCaseWorkflow(opts: {
  unifiedCaseId: string;
  toState: WorkflowState;
  actorRole: string;
  actorName: string;
  note?: string;
  correlationId?: string;
}) {
  const instance = await db.workflowInstance.findUnique({
    where: { unifiedCaseId: opts.unifiedCaseId },
  });

  if (!instance) {
    // If not exists, create with this state
    return initializeCaseWorkflow({
      unifiedCaseId: opts.unifiedCaseId,
      correlationId: opts.correlationId,
    });
  }

  let history: WorkflowTransitionRecord[] = [];
  try { history = JSON.parse(instance.history); } catch {}

  const newTransition: WorkflowTransitionRecord = {
    fromState: instance.currentState,
    toState: opts.toState,
    actorRole: opts.actorRole,
    actorName: opts.actorName,
    note: opts.note,
    timestamp: new Date().toISOString(),
  };

  history.push(newTransition);

  const updated = await db.workflowInstance.update({
    where: { id: instance.id },
    data: {
      currentState: opts.toState,
      history: JSON.stringify(history),
      isCompleted: opts.toState === "RESOLVED",
      completedAt: opts.toState === "RESOLVED" ? new Date() : undefined,
    },
  });

  // Keep UnifiedCase status in sync
  const statusMap: Record<string, string> = {
    CASE_CREATED: "OPEN",
    AI_VALIDATION: "INVESTIGATING",
    DEPARTMENT_ASSIGNMENT: "INVESTIGATING",
    OFFICER_REVIEW: "INVESTIGATING",
    IN_PROGRESS: "IN_PROGRESS",
    RESOLUTION_SUBMITTED: "IN_PROGRESS",
    VERIFICATION: "IN_PROGRESS",
    RESOLVED: "RESOLVED",
    ESCALATED: "ESCALATED",
  };

  await db.unifiedCase.update({
    where: { id: opts.unifiedCaseId },
    data: {
      status: statusMap[opts.toState] ?? "OPEN",
      ...(opts.toState === "RESOLVED" ? { resolvedAt: new Date() } : {}),
    },
  });

  if (opts.correlationId) {
    await publishCivicEvent({
      eventType: "WORKFLOW_TRANSITIONED",
      correlationId: opts.correlationId,
      entityType: "UNIFIED_CASE",
      entityId: opts.unifiedCaseId,
      summary: `Workflow state changed: ${instance.currentState} → ${opts.toState} by ${opts.actorName}`,
      payload: { transition: newTransition },
    });
  }

  await writeAuditLog({
    entityType: "UNIFIED_CASE",
    entityId: opts.unifiedCaseId,
    unifiedCaseId: opts.unifiedCaseId,
    action: opts.toState === "RESOLVED" ? "RESOLVED" : "UPDATED",
    actorType: opts.actorRole,
    actorName: opts.actorName,
    summary: `Case transitioned to ${opts.toState}.${opts.note ? ` Note: ${opts.note}` : ""}`,
  });

  log.info("workflow_transitioned", {
    caseId: opts.unifiedCaseId,
    from: instance.currentState,
    to: opts.toState,
  });

  return updated;
}
