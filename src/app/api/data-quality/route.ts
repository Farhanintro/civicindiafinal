// CIVIC INDIA 2.0 — Data Quality API
import { NextRequest } from "next/server";
import { getDataQualityMetrics, updateDataQualityReview, type DataQualityStatus } from "@/lib/services/data-quality-service";
import { assertApiPermission } from "@/lib/services/rbac-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 50);

    const metrics = await getDataQualityMetrics({ status, limit });
    return Response.json(metrics);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await assertApiPermission(req, "MANAGE_INTEGRATIONS");
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { id, status, reviewer } = body;

    if (!id || !status) {
      return Response.json({ error: "id and status are required" }, { status: 400 });
    }

    const updated = await updateDataQualityReview(id, status as DataQualityStatus, reviewer || "Officer Review");
    return Response.json({ ok: true, record: updated });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
