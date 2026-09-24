// CivicLens — production authentication (NextAuth.js v4, Credentials provider).
// - Citizens: self-service sign-up/sign-in (email + password, bcrypt cost 12)
// - Authority/Admin: provisioned account (seeded; never self-registered)
// - Sessions: signed httpOnly JWT cookies (CSRF-protected by NextAuth)
// - Brute-force protection: per-IP and per-email rate limiting on sign-in
//
// NOTE: the exported interface (getSessionUser / requireRole) is intentionally kept
// identical to the original demo auth so every API route works unchanged.

import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { log } from "@/lib/services/logger";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import type { Role, SessionUser } from "@/lib/civiclens/types";

// ---------- Type augmentation (extra fields on the JWT/session) ----------

declare module "next-auth" {
  interface User {
    id?: string;
    publicId?: string;
    role?: string;
    city?: string | null;
  }
  interface Session {
    user: {
      id: string;
      publicId: string;
      name?: string | null;
      role: string;
      city?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    publicId?: string;
    role?: string;
    city?: string | null;
  }
}

// ---------- NextAuth configuration ----------

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = (credentials?.email ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        // Brute-force protection: 10 attempts / 15 min per IP and per email.
        const ip = requestIp((req as { headers?: Headers } | undefined)?.headers);
        const ipOk = consumeRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000);
        const emailOk = consumeRateLimit(`login:email:${email}`, 10, 15 * 60 * 1000);
        if (!ipOk || !emailOk) {
          log.warn("auth_rate_limited", { ip, email: email.slice(0, 3) + "***" });
          return null;
        }

        try {
          const user = await db.user.findUnique({ where: { email } });
          if (!user?.passwordHash) return null; // unknown account or passwordless legacy user
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;
          return {
            id: user.id,
            publicId: user.publicId,
            name: user.name,
            role: user.role,
            city: user.city,
          };
        } catch (err) {
          log.error("auth_error", { error: String(err).slice(0, 160) });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.publicId = user.publicId;
        token.role = user.role;
        token.city = user.city ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id ?? "",
        publicId: token.publicId ?? "",
        name: token.name ?? "",
        role: token.role ?? "CITIZEN",
        city: token.city ?? null,
      };
      return session;
    },
  },
};

// ---------- Session helpers (same interface as before) ----------

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await getServerSession(authOptions);
    const u = session?.user;
    if (!u?.id || !u.role) return null;
    return {
      id: u.id,
      publicId: u.publicId,
      name: u.name ?? "",
      role: u.role as Role,
      city: u.city ?? null,
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

// ---------- Shared password utilities ----------

export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
