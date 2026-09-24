// POST /api/auth/login — lightweight demo auth (Citizen / Admin).
// Structured so a real auth provider can replace this later.

import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { log } from "@/lib/services/logger";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { role?: string; name?: string; city?: string };
    const role = body.role === "ADMIN" ? "ADMIN" : "CITIZEN";
    const name =
      (body.name ?? "").trim().slice(0, 60) ||
      (role === "ADMIN" ? "Municipal Admin" : "Anonymous Citizen");

    const existing = await db.user.findFirst({
      where: { name, role },
      orderBy: { createdAt: "asc" },
    });

    let user = existing;
    if (!user) {
      const count = await db.user.count();
      user = await db.user.create({
        data: {
          publicId: `USR-${String(count + 1).padStart(3, "0")}`,
          name,
          role,
          city: (body.city ?? "").trim().slice(0, 60) || null,
        },
      });
    }

    await setSession(user.id);
    log.info("api_ok", { route: "auth/login", role });
    return Response.json({
      user: { id: user.id, publicId: user.publicId, name: user.name, role: user.role, city: user.city },
    });
  } catch (err) {
    log.error("api_error", { route: "auth/login", error: String(err).slice(0, 160) });
    return Response.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
