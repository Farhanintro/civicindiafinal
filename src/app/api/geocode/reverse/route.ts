// GET /api/geocode/reverse?lat=&lng= — reverse geocode (null → caller falls back to coordinates)
import { reverseGeocode } from "@/lib/services/geocoding-service";
import { isValidLatLng } from "@/lib/civiclens/geo";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "Invalid coordinates." }, { status: 400 });
  }
  const result = await reverseGeocode(lat, lng);
  return Response.json({ result });
}
