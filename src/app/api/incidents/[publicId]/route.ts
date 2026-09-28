// GET /api/incidents/[publicId] — full incident detail (reports, analysis, timeline,
// assignments, resolution evidence). Public view; reporter names only for admins (privacy).
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getIncidentDetail } from "@/lib/services/incident-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  const detail = await getIncidentDetail(publicId);
  if (!detail) {
    return Response.json({ error: "Incident not found." }, { status: 404 });
  }

  // privacy: citizen identities are never exposed publicly; admins may see names for workflow
  const user = await getSessionUser();
  if (user?.role !== "ADMIN") {
    return Response.json({ incident: detail });
  }

  const reports = await db.report.findMany({
    where: { incidentId: detail.id },
    include: { user: { select: { name: true } } },
  });
  const names = new Map(reports.map((r) => [r.id, r.user.name]));
  return Response.json({
    incident: {
      ...detail,
      reports: detail.reports.map((r) => ({ ...r, reporterName: names.get(r.id) ?? null })),
    },
  });
}
