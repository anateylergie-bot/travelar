export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // strength re-checked explicitly below for a clearer error
  displayName: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
    if (!allowed) {
      throw new AppError("RATE_LIMITED", "Too many registration attempts. Please try again later.");
    }

    const body = await request.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid registration data.", parsed.error.flatten());
    }

    const { email, password, displayName } = parsed.data;

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      throw new AppError("VALIDATION_ERROR", strength.reason ?? "Password does not meet requirements.");
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // Deliberately generic — do not confirm which emails are registered
      // to an unauthenticated caller (spec Section 8 anti-enumeration intent).
      throw new AppError("CONFLICT", "Could not create account with the provided details.");
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName ?? null,
        status: "PENDING_VERIFICATION",
        roles: {
          create: [{ role: "TOURIST" }],
        },
      },
    });

    await writeAuditLog({
      actorUserId: user.id,
      action: "auth.register",
      targetType: "User",
      targetId: user.id,
      ipAddress: ip,
    });

    // Email verification token issuance/sending is architected but not
    // wired to a real email provider in Phase 1 — see PROJECT_AUDIT.md.
    // We deliberately do NOT claim the user is verified here.

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, displayName: user.displayName, status: user.status },
      },
      { status: 201 }
    );
  } catch (err) {
    if (!(err instanceof AppError)) {
      logger.error({ err }, "Unexpected error in /api/auth/register");
    }
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
