// CIVIC INDIA 2.0 — Unified Cases API
// GET: list/fetch unified cases | POST: create new unified case

import { NextRequest } from "next/server";
import {
  getUnifiedCases,
  getUnifiedCase,
  createUnifiedCase,
  updateCaseStatus,
} from "@/lib/services/unified-case-service";
import { assertApiPermission } from "@/lib/services/rbac-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (caseId) {
      const uc = await getUnifiedCase(caseId);
      if (!uc) return Response.json({ error: "Case not found" }, { status: 404 });
      return Response.json({ case: uc });
    }

    const result = await getUnifiedCases({
      status: searchParams.get("status") ?? undefined,
      departmentKey: searchParams.get("departmentKey") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      slaBreached: searchParams.get("slaBreached") === "true" ? true : undefined,
      limit: Number(searchParams.get("limit") ?? 20),
      page: Number(searchParams.get("page") ?? 1),
    });

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, categoryKey, severity, departmentKey, departmentReason,
      latitude, longitude, address, city, district, state, sourceComplaints } = body;

    if (!title || !sourceComplaints?.length) {
      return Response.json(
        { error: "title and at least one sourceComplaint are required" },
        { status: 400 }
      );
    }

    const uc = await createUnifiedCase({
      title,
      description,
      categoryKey,
      severity,
      departmentKey,
      departmentReason,
      latitude,
      longitude,
      address,
      city,
      district,
      state,
      sourceComplaints,
    });

    return Response.json({ case: uc }, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await assertApiPermission(req, "UPDATE_CASE");
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { id, status, note } = body;

    if (!id || !status) {
      return Response.json({ error: "id and status are required" }, { status: 400 });
    }

    await updateCaseStatus(id, status, note);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
