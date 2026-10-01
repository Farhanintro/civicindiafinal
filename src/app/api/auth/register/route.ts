// POST /api/auth/register
// Creates a citizen account and requires email verification.

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/services/logger";
import { sendVerificationEmail } from "@/lib/services/mailer-service";
import { Prisma } from "@prisma/client";

const RegisterSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name is too long"),

  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

async function nextUserPublicId(): Promise<string> {
  const users = await db.user.findMany({
    where: {
      publicId: {
        startsWith: "USR-",
      },
    },

    select: {
      publicId: true,
    },

    take: 500,

    orderBy: {
      publicId: "desc",
    },
  });

  let max = 0;

  for (const user of users) {
    const number = Number(
      user.publicId.split("-")[1]
    );

    if (Number.isFinite(number) && number > max) {
      max = number;
    }
  }

  return `USR-${String(max + 1).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  try {
    const body =
      (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

    const parsed =
      RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Invalid registration details.",
        },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      password,
    } = parsed.data;

    /*
     * Check duplicate account.
     */
    const existing = await db.user.findUnique({
      where: {
        email,
      },
    });

    if (existing) {
      return Response.json(
        {
          error:
            "An account with this email already exists. Please sign in.",
        },
        { status: 409 }
      );
    }

    /*
     * Hash password.
     */
    const passwordHash =
      await bcrypt.hash(password, 10);

    /*
     * Generate public ID.
     */
    const publicId =
      await nextUserPublicId();

    /*
     * Create unverified citizen.
     *
     * emailVerified intentionally remains NULL.
     */
    const user = await db.user.create({
      data: {
        publicId,
        name,
        email,
        passwordHash,
        role: "CITIZEN",
        isDemo: false,
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

    /*
     * Generate a dedicated verification token.
     *
     * This is NOT the login JWT.
     */
    const verificationToken =
      crypto.randomBytes(32).toString("hex");

    /*
     * Token valid for 24 hours.
     */
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    await db.verificationToken.create({
      data: {
        email: user.email!,
        token: verificationToken,
        expiresAt,
      },
    });

    /*
     * Send verification email.
     */
    try {
      await sendVerificationEmail(
        user.email!,
        verificationToken
      );
    } catch (mailError) {
      /*
       * Email failed.
       * Do not leave a half-working account behind.
       */
      await db.verificationToken
        .deleteMany({
          where: {
            token: verificationToken,
          },
        })
        .catch(() => {});

      await db.user
        .delete({
          where: {
            id: user.id,
          },
        })
        .catch(() => {});

      log.error(
        "verification_email_failed",
        {
          email: user.email,
          error: String(mailError).slice(
            0,
            300
          ),
        }
      );

      return Response.json(
        {
          error:
            "Account could not be created because the verification email could not be sent. Please try again.",
        },
        { status: 500 }
      );
    }

    log.info(
      "auth_registered_pending_verification",
      {
        userId: user.id,
        email: user.email,
      }
    );

    /*
     * IMPORTANT:
     *
     * No session cookie.
     * No automatic login.
     */
    return Response.json(
      {
        user: {
          id: user.id,
          publicId: user.publicId,
          name: user.name,
          email: user.email,
          role: user.role,
        },

        requiresVerification: true,

        message:
          "Account created. Please verify your email before signing in.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          error:
            "An account with this email already exists. Please sign in.",
        },
        { status: 409 }
      );
    }

    log.error("api_error", {
      route: "auth/register",
      error: String(error).slice(0, 300),
    });

    return Response.json(
      {
        error:
          "Failed to register. Please try again.",
      },
      { status: 500 }
    );
  }
}