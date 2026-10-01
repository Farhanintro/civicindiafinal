// CIVIC INDIA 2.0 — AI / Civic Intelligence API
import { NextRequest } from "next/server";
import { generateInsights, getInsights, generateRootCause, getRootCauses } from "@/lib/services/civic-intelligence-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "root-cause") {
      const incidentId = searchParams.get("incidentId");
      if (incidentId) {
        const analyses = await getRootCauses({ incidentId });
        return Response.json({ analyses });
      }
      const all = await getRootCauses({ limit: 20 });
      return Response.json({ analyses: all });
    }

    const insights = await getInsights({
      type: searchParams.get("type") ?? undefined,
      isActive: searchParams.get("isActive") === "false" ? false : true,
      limit: Number(searchParams.get("limit") ?? 30),
    });
    return Response.json({ insights });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, incidentId } = body;

    if (action === "generate-insights") {
      const insights = await generateInsights();
      return Response.json({ ok: true, generated: insights.length, insights });
    }

    if (action === "root-cause" && incidentId) {
      const analysis = await generateRootCause(incidentId);
      if (!analysis) return Response.json({ error: "Could not generate analysis" }, { status: 400 });
      return Response.json({ analysis });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
