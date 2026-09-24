// POST /api/reports/submit — finalize a report: duplicate check → link to existing
// incident OR create a new incident (with priority + department routing).

import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  createIncidentFromReport,
  linkReportToIncident,
} from "@/lib/services/incident-service";
import { findDuplicateCandidates } from "@/lib/services/duplicate-service";
import { reverseGeocode } from "@/lib/services/geocoding-service";
import { haversineMeters, isValidLatLng } from "@/lib/civiclens/geo";
import { log } from "@/lib/services/logger";

const BodySchema = z.object({
  reportId: z.string().min(1),
  categoryKey: z.string().optional(),
  description: z.string().max(600).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z
    .object({
      display: z.string(),
      road: z.string().optional().nullable(),
      suburb: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      district: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      country: z.string().optional().nullable(),
      postcode: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  locationChanged: z.boolean().optional(),
  decision: z.enum(["link", "new"]).optional(),
  linkToIncidentPublicId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Please sign in to submit a report." }, { status: 401 });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid request.", details: String(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const report = await db.report.findUnique({
      where: { id: body.reportId },
      include: { aiAnalysis: true },
    });
    if (!report) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }
    if (report.userId !== user.id) {
      return Response.json({ error: "You can only submit your own report." }, { status: 403 });
    }
    if (report.incidentId) {
      return Response.json({ error: "This report was already submitted." }, { status: 409 });
    }

    // ---- Final location (may have been adjusted manually) ----
    const latitude = isValidLatLng(body.latitude, body.longitude ?? 999)
      ? body.latitude!
      : report.latitude;
    const longitude = isValidLatLng(body.latitude ?? -999, body.longitude)
      ? body.longitude!
      : report.longitude;

    const movedMeters = haversineMeters(report.latitude, report.longitude, latitude, longitude);
    const locationChanged = body.locationChanged || movedMeters > 50;

    await db.report.update({
      where: { id: report.id },
      data: {
        latitude,
        longitude,
        description: body.description?.trim() || report.description,
        locationChanged,
        submissionTimestamp: new Date(),
      },
    });

    // ---- Final category (manual override when AI was edited / unavailable) ----
    const categoryKey = body.categoryKey || report.aiAnalysis?.categoryKey || "other";
    const category = await db.category.findUnique({ where: { key: categoryKey } });
    if (!category) {
      return Response.json({ error: "Unknown category." }, { status: 400 });
    }

    // ---- Duplicate detection: nearby active incidents of the same/similar category ----
    const candidates = await findDuplicateCandidates(latitude, longitude, categoryKey);

    if (candidates.length > 0) {
      if (body.decision === "link" && body.linkToIncidentPublicId) {
        // validate the chosen target is actually one of the nearby candidates
        // (prevents linking to resolved/distant incidents from a stale list)
        const target = candidates.find((c) => c.publicId === body.linkToIncidentPublicId);
        if (!target) {
          return Response.json(
            { error: "The selected incident is no longer a nearby active duplicate. Please review the list again.", requiresDecision: true, duplicateCandidates: candidates },
            { status: 409 }
          );
        }
        const targetIncident = await db.incident.findUnique({ where: { publicId: body.linkToIncidentPublicId } });
        if (!targetIncident) {
          return Response.json({ error: "The selected incident no longer exists." }, { status: 404 });
        }
        const incident = await linkReportToIncident(report, targetIncident.id);
        return Response.json({ ok: true, incident, linked: true });
      }
      if (body.decision !== "new") {
        // Citizen must choose: link to the existing physical problem, or create a new one.
        return Response.json({ ok: false as const, requiresDecision: true, duplicateCandidates: candidates });
      }
      // decision === "new" → deliberately create a separate incident
    }

    // ---- Create a new incident ----
    let geo = body.address ?? null;
    if (!geo) {
      geo = await reverseGeocode(latitude, longitude); // best-effort; null → coordinates only
    }

    const analysis = report.aiAnalysis
      ? {
          isCivicIssue: report.aiAnalysis.isCivicIssue,
          categoryKey: report.aiAnalysis.categoryKey,
          confidence: report.aiAnalysis.confidence,
          severity: report.aiAnalysis.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN",
          severityScore: report.aiAnalysis.severityScore,
          hazards: JSON.parse(report.aiAnalysis.hazards || "[]"),
          departmentKey: report.aiAnalysis.departmentKey,
          description: report.aiAnalysis.description,
          reasoning: report.aiAnalysis.reasoning,
          recommendedAction: report.aiAnalysis.recommendedAction,
          model: report.aiAnalysis.model,
          source: report.aiAnalysis.source as "VLM_SDK" | "GEMINI" | "DEMO_PRECOMPUTED" | "FALLBACK_MANUAL",
          processingMs: report.aiAnalysis.processingMs ?? 0,
        }
      : null;

    const incident = await createIncidentFromReport({
      report: { ...report, latitude, longitude },
      analysis,
      categoryKey,
      geo,
      latitude,
      longitude,
    });

    log.info("report_created", { report: report.publicId, incident: incident.publicId, newIncident: true });
    return Response.json({ ok: true, incident, linked: false });
  } catch (err) {
    log.error("api_error", { route: "reports/submit", error: String(err).slice(0, 200) });
    return Response.json(
      { error: "Could not submit the report. Please try again — your report is safe." },
      { status: 500 }
    );
  }
}
