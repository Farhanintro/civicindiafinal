// POST /api/reports/analyze — multimodal AI analysis of citizen photo evidence.
//
// Quota discipline (mandatory):
//   • Idempotency key: a repeated request (double-click, refresh, retry) returns the
//     STORED analysis — Gemini/VLM is never called twice for the same report.
//   • Sample photos use precomputed results (zero API calls).
//   • AI failures never reject the report — a manual-classification fallback is stored.

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { analyzeCivicImage } from "@/lib/services/ai-service";
import { storeImage, validateImage } from "@/lib/services/storage-service";
import { findDuplicateCandidates } from "@/lib/services/duplicate-service";
import { toCivicAnalysis, toReportDTO } from "@/lib/services/incident-service";
import { isValidLatLng } from "@/lib/civiclens/geo";
import { SAMPLE_PHOTOS } from "@/lib/civiclens/constants";
import { log } from "@/lib/services/logger";
import { readFile } from "fs/promises";
import path from "path";

export const maxDuration = 120;

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Please sign in to report an issue." }, { status: 401 });
    }

    const form = await req.formData();
    const idempotencyKey = String(form.get("idempotencyKey") ?? "").trim();
    if (!idempotencyKey || idempotencyKey.length > 80) {
      return Response.json({ error: "Missing idempotency key." }, { status: 400 });
    }

    const latitude = Number(form.get("latitude"));
    const longitude = Number(form.get("longitude"));
    if (!isValidLatLng(latitude, longitude)) {
      return Response.json({ error: "Valid GPS coordinates are required to place the report." }, { status: 400 });
    }

    const captureTimestamp = (() => {
      const raw = String(form.get("captureTimestamp") ?? "");
      const d = new Date(raw);
      return Number.isFinite(d.getTime()) ? d : new Date();
    })();
    const description = String(form.get("description") ?? "").trim().slice(0, 600) || null;
    const sampleKeyRaw = String(form.get("sampleKey") ?? "").trim();
    const sample = SAMPLE_PHOTOS.find((s) => s.key === sampleKeyRaw) ?? null;

    // ---- Idempotency: return the stored analysis instead of calling AI again ----
    const existing = await db.report.findUnique({
      where: { idempotencyKey },
      include: { aiAnalysis: true, incident: { select: { publicId: true } } },
    });
    if (existing && existing.userId !== user.id) {
      // idempotency keys are client-generated; never leak another user's analysis
      return Response.json({ error: "Invalid idempotency key." }, { status: 400 });
    }
    if (existing && existing.aiAnalysis) {
      log.info("ai_cached", { report: existing.publicId });
      const candidates = await findDuplicateCandidates(latitude, longitude, existing.aiAnalysis.categoryKey);
      return Response.json({
        reportId: existing.id,
        reportPublicId: existing.publicId,
        analysis: toCivicAnalysis(existing.aiAnalysis),
        duplicateCandidates: candidates,
        cached: true,
      });
    }
    if (existing && !existing.aiAnalysis) {
      // A previous request is (or was) processing this exact report.
      // If it crashed mid-analysis, reclaim the idempotency key after 3 minutes.
      if (Date.now() - existing.createdAt.getTime() > 3 * 60 * 1000) {
        await db.incidentReport.deleteMany({ where: { reportId: existing.id } });
        await db.report.delete({ where: { id: existing.id } }).catch(() => {});
        log.warn("ai_failure", { recovered: "stale_processing_report", report: existing.publicId });
      } else {
        return Response.json(
          { error: "This report is still being analyzed. Please wait a moment.", processing: true },
          { status: 409 }
        );
      }
    }

    // ---- Evidence: uploaded photo or bundled sample ----
    let imagePath: string | null = null;
    let imageBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    const file = form.get("image");
    if (file && file instanceof File && file.size > 0) {
      const invalid = validateImage({ type: file.type, size: file.size });
      if (invalid) {
        log.warn("upload_rejected", { reason: invalid });
        return Response.json({ error: invalid }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storeImage(buffer, file.type);
      imagePath = stored.url;
      imageBuffer = buffer;
      mimeType = file.type;
    } else if (sample) {
      imagePath = sample.path;
      try {
        imageBuffer = await readFile(path.join(process.cwd(), "public", sample.path));
        mimeType = "image/png";
      } catch {
        imageBuffer = null; // precomputed result doesn't need the bytes anyway
      }
    } else {
      return Response.json({ error: "Please add a photo of the issue (or pick a sample photo)." }, { status: 400 });
    }

    // ---- Create the report row (PROCESSING) ----
    let report;
    try {
      report = await db.report.create({
        data: {
          publicId: await nextRepId(),
          userId: user.id,
          imagePath,
          description,
          latitude,
          longitude,
          captureTimestamp,
          submissionTimestamp: new Date(),
          processingState: "PROCESSING",
          idempotencyKey,
          isDemo: Boolean(sample), // sample-based reports are demo-labelled
        },
      });
    } catch {
      // unique race on idempotencyKey (double-click) — return the stored one
      const race = await db.report.findUnique({
        where: { idempotencyKey },
        include: { aiAnalysis: true, incident: { select: { publicId: true } } },
      });
      if (race?.aiAnalysis) {
        const candidates = await findDuplicateCandidates(latitude, longitude, race.aiAnalysis.categoryKey);
        return Response.json({
          reportId: race.id,
          reportPublicId: race.publicId,
          analysis: toCivicAnalysis(race.aiAnalysis),
          duplicateCandidates: candidates,
          cached: true,
        });
      }
      return Response.json(
        { error: "This report is still being analyzed. Please wait a moment.", processing: true },
        { status: 409 }
      );
    }

    // ---- ONE AI analysis per report ----
    const result = await analyzeCivicImage({
      imageBuffer: imageBuffer ?? Buffer.alloc(0),
      mimeType,
      description,
      sampleKey: sample?.key ?? null,
    });

    const analysis = await db.aiAnalysis.create({
      data: {
        reportId: report.id,
        model: result.model,
        source: result.source,
        isCivicIssue: result.isCivicIssue,
        categoryKey: result.categoryKey,
        confidence: result.confidence,
        severity: result.severity,
        severityScore: result.severityScore,
        hazards: JSON.stringify(result.hazards),
        departmentKey: result.departmentKey,
        description: result.description,
        reasoning: result.reasoning,
        recommendedAction: result.recommendedAction,
        rawResult: JSON.stringify(result),
        processingMs: Date.now() - started,
      },
    });
    await db.report.update({
      where: { id: report.id },
      data: { aiAnalysisId: analysis.id },
    });

    const candidates = await findDuplicateCandidates(latitude, longitude, result.categoryKey);

    log.info("report_created", {
      report: report.publicId,
      category: result.categoryKey,
      source: result.source,
      ms: Date.now() - started,
    });

    return Response.json({
      reportId: report.id,
      reportPublicId: report.publicId,
      analysis: toCivicAnalysis(analysis),
      duplicateCandidates: candidates,
      cached: false,
    });
  } catch (err) {
    log.error("api_error", { route: "reports/analyze", error: String(err).slice(0, 200) });
    return Response.json(
      { error: "Could not process the report. Your photo and location were not lost — please try again." },
      { status: 500 }
    );
  }
}

async function nextRepId(): Promise<string> {
  const rows = await db.report.findMany({
    where: { publicId: { startsWith: "REP-" } },
    select: { publicId: true },
    take: 500,
    orderBy: { publicId: "desc" },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.publicId.split("-")[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `REP-${String(max + 1).padStart(4, "0")}`;
}
