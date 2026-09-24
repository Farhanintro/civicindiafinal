// GET /api/reports/mine — the signed-in citizen's reports (with incident summaries)
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { toIncidentSummary, toReportDTO } from "@/lib/services/incident-service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  const reports = await db.report.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      aiAnalysis: true,
      incident: { include: { category: true, department: true } },
    },
  });

  return Response.json({
    reports: reports.map((r) => ({
      ...toReportDTO(r),
      incident: r.incident ? toIncidentSummary(r.incident) : null,
    })),
  });
}
