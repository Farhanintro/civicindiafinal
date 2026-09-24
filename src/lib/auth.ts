// CivicLens — lightweight demo authentication.
// httpOnly cookie session; structured so real auth (NextAuth/Supabase Auth) can replace it later.

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/civiclens/constants";
import type { Role, SessionUser } from "@/lib/civiclens/types";

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const uid = jar.get(SESSION_COOKIE)?.value;
    if (!uid) return null;
    const user = await db.user.findUnique({ where: { id: uid } });
    if (!user) return null;
    return {
      id: user.id,
      publicId: user.publicId,
      name: user.name,
      role: user.role as Role,
      city: user.city,
    };
  } catch {
    return null;
  }
}

export async function requireRole(role: Role): Promise<
  { user: SessionUser } | { error: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      error: Response.json({ error: "Not authenticated. Please sign in." }, { status: 401 }),
    };
  }
  if (user.role !== role && role === "ADMIN") {
    return {
      error: Response.json({ error: "Admin access required." }, { status: 403 }),
    };
  }
  return { user };
}
