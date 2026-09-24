// POST /api/seed — (re)seed demo data for the SIH demonstration. Admin-only.
import { requireRole } from "@/lib/auth";
import { log } from "@/lib/services/logger";

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if ("error" in guard) return guard.error;

  try {
    const url = new URL(req.url);
    const reset = url.searchParams.get("reset") === "1";
    const { seedDemoData } = await import("@/lib/services/seed-service");
    const result = await seedDemoData({ reset });
    return Response.json(result);
  } catch (err) {
    log.error("api_error", { route: "seed", error: String(err).slice(0, 200) });
    return Response.json({ error: "Seed failed.", details: String(err).slice(0, 200) }, { status: 500 });
  }
}
