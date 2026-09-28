// POST /api/reports/submit — complete citizen report submission.
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { findDuplicateCandidates } from "@/lib/services/duplicate-service";
import {
  createIncidentFromReport,
  linkReportToIncident,
  toCivicAnalysis,
} from "@/lib/services/incident-service";
import { log } from "@/lib/services/logger";

const AddressSchema = z
  .object({
    display: z.string().optional(),
    road: z.string().optional(),
    neighbourhood: z.string().optional(),
    suburb: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
  })
  .optional();

const SubmitSchema = z.object({
  reportId: z.string().min(1),
  categoryKey: z.string().optional(),
  description: z.string().max(600).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: AddressSchema,
  locationChanged: z.boolean().optional(),
  decision: z.enum(["link", "new"]).optional(),
  linkToIncidentPublicId: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid submission.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      reportId,
      categoryKey: userCategoryKey,
      description,
      latitude: finalLat,
      longitude: finalLng,
      address,
      locationChanged,
      decision,
      linkToIncidentPublicId,
    } = parsed.data;

    const report = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return Response.json({ error: "Report not found." }, { status: 404 });
    }

    if (report.userId !== user.id && user.role !== "ADMIN") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const aiAnalysis = await db.aiAnalysis.findUnique({
      where: { reportId: report.id },
    });

    if (aiAnalysis && aiAnalysis.isCivicIssue === false) {
      return Response.json(
        {
          error: "Submission rejected: The uploaded image was not verified as a genuine civic infrastructure issue.",
        },
        { status: 400 }
      );
    }

    if (report.incidentId) {
      return Response.json(
        { error: "This report has already been submitted and linked to an incident." },
        { status: 409 }
      );
    }

    const categoryKey = userCategoryKey || aiAnalysis?.categoryKey || "other";
    const category = await db.category.findUnique({ where: { key: categoryKey } });
    if (!category) {
      return Response.json({ error: "Unknown category." }, { status: 400 });
    }

    const latitude = finalLat ?? report.latitude;
    const longitude = finalLng ?? report.longitude;

    const candidates = await findDuplicateCandidates(latitude, longitude, categoryKey);

    if (candidates.length > 0 && !decision) {
      return Response.json({
        requiresDecision: true,
        duplicateCandidates: candidates,
      });
    }

    const updatedReport = await db.report.update({
      where: { id: report.id },
      data: {
        description: description?.trim() || report.description,
        latitude,
        longitude,
        locationChanged: locationChanged ?? report.locationChanged,
        submissionTimestamp: new Date(),
        processingState: "SUBMITTED",
      },
    });

    if (decision === "link" && linkToIncidentPublicId) {
      const target = await db.incident.findUnique({
        where: { publicId: linkToIncidentPublicId },
      });

      if (!target) {
        return Response.json(
          { error: `Target incident ${linkToIncidentPublicId} not found.` },
          { status: 404 }
        );
      }

      const incident = await linkReportToIncident(updatedReport, target.id);
      log.info("report_linked", {
        reportPublicId: updatedReport.publicId,
        incidentPublicId: incident.publicId,
      });
      return Response.json({ incident, linked: true }, { status: 200 });
    }

    const civicAnalysisDTO = aiAnalysis ? toCivicAnalysis(aiAnalysis) : null;
    const geoDTO = address ? {
      display: address.display ?? "",
      road: address.road,
      neighbourhood: address.neighbourhood,
      suburb: address.suburb,
      city: address.city,
      district: address.district,
      state: address.state,
      postcode: address.postcode,
    } : null;

    const incident = await createIncidentFromReport({
      report: updatedReport,
      analysis: civicAnalysisDTO,
      categoryKey,
      geo: geoDTO,
      latitude,
      longitude,
    });

    log.info("incident_created", {
      reportPublicId: updatedReport.publicId,
      incidentPublicId: incident.publicId,
      categoryKey,
    });

    return Response.json({ incident, linked: false }, { status: 201 });
  } catch (err) {
    console.error("Submit error details:", err);
    log.error("api_error", { route: "reports/submit", error: String(err).slice(0, 160) });
    return Response.json({ error: "Failed to submit report. Please try again." }, { status: 500 });
  }
}