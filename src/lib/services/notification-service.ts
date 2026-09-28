// CivicLens — Notification service (in-app MVP; SMS/WhatsApp/email pluggable later).

import { db } from "@/lib/db";

export type NotificationType =
  | "REPORT_SUBMITTED"
  | "LINKED"
  | "STATUS_CHANGE"
  | "ASSIGNED"
  | "RESOLVED"
  | "SYSTEM";

export async function notifyUser(opts: {
  userId: string;
  incidentId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
}) {
  try {
    await db.notification.create({
      data: {
        userId: opts.userId,
        incidentId: opts.incidentId ?? null,
        type: opts.type,
        title: opts.title,
        body: opts.body,
      },
    });
  } catch {
    // notifications must never break the main flow
  }
}

/** Notify every citizen whose report is linked to this incident. */
export async function notifyIncidentReporters(
  incidentId: string,
  payload: { type: NotificationType; title: string; body: string }
) {
  try {
    const reports = await db.report.findMany({
      where: { incidentId },
      select: { userId: true },
    });
    const userIds = [...new Set(reports.map((r) => r.userId))];
    if (userIds.length === 0) return;
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        incidentId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
      })),
    });
  } catch {
    // never break the main flow
  }
}
