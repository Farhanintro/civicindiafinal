// GET /api/geocode/search?q= — forward geocode (manual location fallback, India-biased)
import { forwardGeocode } from "@/lib/services/geocoding-service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ hits: [] });
  const hits = await forwardGeocode(q);
  return Response.json({ hits });
}
