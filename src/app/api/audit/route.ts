// CIVIC INDIA 2.0 — Audit Trail API
import { NextRequest } from "next/server";
import { getAuditLogs, getRecentAuditLogs } from "@/lib/services/audit-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") ?? undefined;
    const entityId = searchParams.get("entityId") ?? undefined;
    const incidentId = searchParams.get("incidentId") ?? undefined;
    const unifiedCaseId = searchParams.get("unifiedCaseId") ?? undefined;

    if (!entityType && !entityId && !incidentId && !unifiedCaseId) {
      const logs = await getRecentAuditLogs(Number(searchParams.get("limit") ?? 30));
      return Response.json({ logs });
    }

    const result = await getAuditLogs({
      entityType,
      entityId,
      incidentId,
      unifiedCaseId,
      limit: Number(searchParams.get("limit") ?? 50),
      page: Number(searchParams.get("page") ?? 1),
    });

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
