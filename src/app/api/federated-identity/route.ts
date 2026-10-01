// CIVIC INDIA 2.0 — Federated Identity & SSO API
import { NextRequest } from "next/server";
import { getFederatedPersonas, simulateFederatedLogin } from "@/lib/services/federated-identity-service";
import { createSession } from "@/lib/auth";

export async function GET() {
  try {
    const personas = await getFederatedPersonas();
    return Response.json({ personas });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subjectId } = body;

    if (!subjectId) {
      return Response.json({ error: "subjectId is required" }, { status: 400 });
    }

    const result = await simulateFederatedLogin(subjectId);
    if (!result.success || !result.user) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    // Set auth cookie
    await createSession({
      id: result.user.id,
      publicId: result.user.publicId,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    });

    return Response.json({ ok: true, user: result.user });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
