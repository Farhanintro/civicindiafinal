// CIVIC INDIA 2.0 — Events & Trace API
import { NextRequest } from "next/server";
import { getEventsByTrace, getRecentEvents } from "@/lib/services/event-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const trace = searchParams.get("trace") || searchParams.get("correlationId");

    if (trace) {
      const events = await getEventsByTrace(trace);
      return Response.json({ events, correlationId: trace });
    }

    const limit = Number(searchParams.get("limit") ?? 50);
    const events = await getRecentEvents(limit);
    return Response.json({ events });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
