// CIVIC INDIA 2.0 — SLA API
import { NextRequest } from "next/server";
import { ensureSlaConfigs, getAllSlaConfigs, getSlaTrackers, getSlaSummary, checkSlaStatuses } from "@/lib/services/sla-service";

export async function GET(req: NextRequest) {
  try {
    await ensureSlaConfigs();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "check") {
      const result = await checkSlaStatuses();
      return Response.json({ ok: true, ...result });
    }

    if (action === "configs") {
      const configs = await getAllSlaConfigs();
      return Response.json({ configs });
    }

    if (action === "trackers") {
      const trackers = await getSlaTrackers({
        status: searchParams.get("status") ?? undefined,
        priority: searchParams.get("priority") ?? undefined,
        limit: Number(searchParams.get("limit") ?? 50),
      });
      return Response.json({ trackers });
    }

    const summary = await getSlaSummary();
    const configs = await getAllSlaConfigs();
    const trackers = await getSlaTrackers({ limit: 20 });
    return Response.json({ summary, configs, trackers });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
