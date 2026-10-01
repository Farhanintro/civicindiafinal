// CIVIC INDIA 2.0 — Citizen Consent API
import { NextRequest } from "next/server";
import { getConsents, grantConsent, revokeConsent, restoreConsent } from "@/lib/services/consent-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const citizenId = searchParams.get("citizenId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const consents = await getConsents({ citizenId, status });
    return Response.json({ consents });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { citizenId, citizenName, requestingSystem, receivingSystem, purpose, allowedFields, restrictedFields, durationDays } = body;

    if (!citizenId || !citizenName || !requestingSystem || !receivingSystem || !purpose) {
      return Response.json({ error: "Missing mandatory consent parameters" }, { status: 400 });
    }

    const consent = await grantConsent({
      citizenId,
      citizenName,
      requestingSystem,
      receivingSystem,
      purpose,
      allowedFields: allowedFields ?? ["location", "description", "evidence"],
      restrictedFields: restrictedFields ?? ["phone", "email"],
      durationDays: durationDays ?? 30,
    });

    return Response.json({ ok: true, consent }, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const consentId = body.consentId || body.id;
    const action = body.action || "REVOKE";
    const citizenName = body.citizenName;

    if (!consentId) {
      return Response.json({ error: "consentId or id is required" }, { status: 400 });
    }

    if (action === "GRANT") {
      const consent = await restoreConsent(consentId, citizenName);
      return Response.json({ ok: true, consent });
    } else {
      const consent = await revokeConsent(consentId, citizenName);
      return Response.json({ ok: true, consent });
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
