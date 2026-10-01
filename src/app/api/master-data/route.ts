// CIVIC INDIA 2.0 — Master Data API
import { NextRequest } from "next/server";
import { getMasterDataSummary, resolveMasterRoad, resolveMasterCitizen } from "@/lib/services/master-data-service";

export async function GET() {
  try {
    const summary = await getMasterDataSummary();
    return Response.json(summary);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, citizenName, contact, sourceSystemCode, latitude, longitude } = body;

    const [roadMatch, citizenMatch] = await Promise.all([
      resolveMasterRoad({ address, sourceSystemCode, latitude, longitude }),
      resolveMasterCitizen({ citizenName, contact, sourceSystemCode }),
    ]);

    return Response.json({
      roadMatch,
      citizenMatch,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
