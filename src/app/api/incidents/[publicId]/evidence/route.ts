// POST /api/incidents/[publicId]/evidence — admin uploads resolution evidence (after photo)
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { storeImage, validateImage } from "@/lib/services/storage-service";
import { log } from "@/lib/services/logger";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const guard = await requireRole("ADMIN");
  if ("error" in guard) return guard.error;
  const admin = guard.user;

  try {
    const { publicId } = await params;
    const incident = await db.incident.findUnique({ where: { publicId } });
    if (!incident) {
      return Response.json({ error: "Incident not found." }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("image");
    const note = String(form.get("note") ?? "").trim().slice(0, 600) || null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Please attach an after photo as resolution evidence." }, { status: 400 });
    }
    const invalid = validateImage({ type: file.type, size: file.size });
    if (invalid) {
      return Response.json({ error: invalid }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeImage(buffer, file.type, "evidence");

    const evidence = await db.resolutionEvidence.create({
      data: {
        incidentId: incident.id,
        imagePath: stored.url,
        note,
        uploadedById: admin.id,
      },
    });

    log.info("upload_stored", { kind: "resolution_evidence", incident: incident.publicId });
    return Response.json({
      evidence: {
        id: evidence.id,
        imagePath: evidence.imagePath,
        note: evidence.note,
        createdAt: evidence.createdAt.toISOString(),
      },
    });
  } catch (err) {
    log.error("api_error", { route: "incidents/evidence", error: String(err).slice(0, 200) });
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
