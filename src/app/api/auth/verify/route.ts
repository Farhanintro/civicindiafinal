// GET /api/auth/verify?token=...
// Verifies a citizen email using a single-use token.

import { db } from "@/lib/db";
import { log } from "@/lib/services/logger";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const token = (
    url.searchParams.get("token") ?? ""
  ).trim();

  const origin = url.origin;

  if (!token) {
    return NextResponse.redirect(
      `${origin}/?verified=false&reason=missing_token`
    );
  }

  try {
    const record =
      await db.verificationToken.findUnique({
        where: {
          token,
        },
      });

    /*
     * Invalid token.
     */
    if (!record) {
      return NextResponse.redirect(
        `${origin}/?verified=false&reason=invalid_token`
      );
    }

    /*
     * Expired token.
     */
    if (record.expiresAt < new Date()) {
      await db.verificationToken
        .delete({
          where: {
            id: record.id,
          },
        })
        .catch(() => {});

      return NextResponse.redirect(
        `${origin}/?verified=false&reason=expired`
      );
    }

    /*
     * Verify user + consume token atomically.
     */
    await db.$transaction([
      db.user.update({
        where: {
          email: record.email,
        },

        data: {
          emailVerified: new Date(),
        },
      }),

      db.verificationToken.delete({
        where: {
          id: record.id,
        },
      }),
    ]);

    log.info("auth_email_verified", {
      email: record.email,
    });

    /*
     * User is verified, but NOT automatically signed in.
     * They must explicitly sign in.
     */
    return NextResponse.redirect(
      `${origin}/?verified=true`
    );
  } catch (error) {
    log.error("api_error", {
      route: "auth/verify",
      error: String(error).slice(0, 200),
    });

    return NextResponse.redirect(
      `${origin}/?verified=false&reason=server_error`
    );
  }
}