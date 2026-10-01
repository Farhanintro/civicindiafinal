import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const AUTH_COOKIE_NAME = "cl_session";
const FALLBACK_COOKIE_NAME = "civiclens_session";

const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.JWT_SECRET ||
  "civiclens-production-secret-key-32-chars-minimum!";

export interface SessionUser {
  id: string;
  publicId: string;
  name: string;
  email: string;
  role: string;
}

/* =========================================================
   NEXTAUTH
========================================================= */

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();

        const user = await db.user.findUnique({
          where: {
            email,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordValid) {
          return null;
        }

        /*
         * Citizens must verify their email before signing in.
         * Admins are allowed to sign in without email verification.
         */
        if (user.role !== "ADMIN" && !user.emailVerified) {
          throw new Error(
            "Please verify your email address before signing in."
          );
        }

        return {
          id: user.id,
          publicId: user.publicId,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.publicId = (user as any).publicId;
        token.role = (user as any).role;
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).publicId = token.publicId;
        (session.user as any).role = token.role;
      }

      return session;
    },
  },

  pages: {
    signIn: "/",
  },

  secret: AUTH_SECRET,
};

/* =========================================================
   CUSTOM TOKEN SESSION
========================================================= */

export function signToken(payload: SessionUser): string {
  const header = Buffer.from(
    JSON.stringify({
      alg: "HS256",
      typ: "JWT",
    })
  ).toString("base64url");

  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    })
  ).toString("base64url");

  const unsigned = `${header}.${body}`;

  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(unsigned)
    .digest("base64url");

  return `${unsigned}.${signature}`;
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const [header, body, signature] = parts;

    const unsigned = `${header}.${body}`;

    const expectedSignature = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(unsigned)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (
      !payload.id ||
      !payload.publicId ||
      !payload.email ||
      !payload.role
    ) {
      return null;
    }

    return {
      id: String(payload.id),
      publicId: String(payload.publicId),
      name: String(payload.name ?? ""),
      email: String(payload.email),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

/* =========================================================
   COOKIE SESSION HELPERS
========================================================= */

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };

  cookieStore.set(AUTH_COOKIE_NAME, token, options);
  cookieStore.set(FALLBACK_COOKIE_NAME, token, options);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(FALLBACK_COOKIE_NAME);
}

export async function createSession(
  user: SessionUser
): Promise<string> {
  const token = signToken(user);

  await setSessionCookie(token);

  return token;
}

export function createSessionToken(user: SessionUser): string {
  return signToken(user);
}

/* =========================================================
   CURRENT USER
========================================================= */

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    /*
     * First check NextAuth session.
     */
    const nextAuthSession = await getServerSession(authOptions);

    if (
      nextAuthSession?.user &&
      (nextAuthSession.user as any).id
    ) {
      const user = await db.user.findUnique({
        where: {
          id: (nextAuthSession.user as any).id,
        },

        select: {
          id: true,
          publicId: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
        },
      });

      if (user) {
        /*
         * Extra server-side protection:
         * an unverified citizen cannot use an existing session.
         */
        if (user.role !== "ADMIN" && !user.emailVerified) {
          return null;
        }

        return {
          id: user.id,
          publicId: user.publicId,
          name: user.name,
          email: user.email ?? "",
          role: user.role,
        };
      }
    }

    /*
     * Fallback to old CivicLens custom cookie.
     */
    const cookieStore = await cookies();

    const token =
      cookieStore.get(AUTH_COOKIE_NAME)?.value ||
      cookieStore.get(FALLBACK_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);

    if (!decoded?.id) {
      return null;
    }

    const user = await db.user.findUnique({
      where: {
        id: decoded.id,
      },

      select: {
        id: true,
        publicId: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return null;
    }

    /*
     * Extra protection for old/custom sessions too.
     */
    if (user.role !== "ADMIN" && !user.emailVerified) {
      return null;
    }

    return {
      id: user.id,
      publicId: user.publicId,
      name: user.name,
      email: user.email ?? "",
      role: user.role,
    };
  } catch {
    return null;
  }
}

export const getCurrentUser = getSessionUser;

/* =========================================================
   ROLE GUARD
========================================================= */

/*
 * Used by admin-only API routes:
 *
 * const guard = await requireRole("ADMIN");
 * if ("error" in guard) return guard.error;
 * const admin = guard.user;
 */
export async function requireRole(requiredRole: string) {
  const user = await getSessionUser();

  if (!user) {
    return {
      error: Response.json(
        {
          error: "Unauthorized. Please sign in.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  if (user.role !== requiredRole) {
    return {
      error: Response.json(
        {
          error: "Forbidden. You do not have permission to perform this action.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    user,
  };
}