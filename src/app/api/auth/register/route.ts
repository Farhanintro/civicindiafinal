// POST /api/auth/register — citizen self-service sign-up.
// Email + password (bcrypt cost 12). NEVER creates ADMIN accounts — authority
// accounts are provisioned via the seed (env-configurable). Rate limited per IP.
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { log } from "@/lib/services/logger";

const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(60, "Name must be at most 60 characters."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(120),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters.")
    .regex(/[A-Za-z]/, "Password must contain at least one letter.")
    .regex(/[0-9]/, "Password must contain at least one number."),
});

export async function POST(req: Request) {
  try {
    // 5 sign-ups / 15 min per IP
    const ip = requestIp(req.headers);
    if (!consumeRateLimit(`register:ip:${ip}`, 5, 15 * 60 * 1000)) {
      return Response.json(
        { error: "Too many sign-up attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid sign-up details.";
      return Response.json({ error: msg }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const count = await db.user.count();
    const user = await db.user.create({
      data: {
        publicId: `USR-${String(count + 1).padStart(3, "0")}`,
        name: parsed.data.name,
        email,
        passwordHash,
        role: "CITIZEN", // sign-up is citizen-only; admin accounts are provisioned via seed
      },
      select: { publicId: true },
    });

    log.info("auth_signup", { publicId: user.publicId });
    return Response.json({ ok: true, publicId: user.publicId }, { status: 201 });
  } catch (err) {
    log.error("api_error", { route: "auth/register", error: String(err).slice(0, 160) });
    return Response.json({ error: "Sign-up failed. Please try again." }, { status: 500 });
  }
}
