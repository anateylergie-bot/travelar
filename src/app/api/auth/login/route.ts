export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5);
const WINDOW_MS = Number(process.env.LOGIN_ATTEMPT_WINDOW_MINUTES ?? 15) * 60 * 1000;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  let attemptedEmail: string | undefined;

  try {
    assertSameOrigin(request);

    const body = await request.json().catch(() => null);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid login data.", parsed.error.flatten());
    }

    const { email, password } = parsed.data;
    attemptedEmail = email;

    const { allowed } = checkRateLimit(`login:${email}:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!allowed) {
      throw new AppError("RATE_LIMITED", "Too many login attempts. Please try again later.");
    }

    const user = await db.user.findUnique({ where: { email }, include: { roles: true } });

    const genericFailure = () => new AppError("UNAUTHENTICATED", "Invalid email or password.");

    if (!user) throw genericFailure();

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) throw genericFailure();

    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new AppError("UNAUTHORIZED", "This account is not active. Contact support.");
    }

    const { rawToken, expiresAt } = await createSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
      ipAddress: ip,
    });

    await db.loginAttempt.create({ data: { email, ipAddress: ip, success: true, userId: user.id } });
    await writeAuditLog({
      actorUserId: user.id,
      action: "auth.login.success",
      targetType: "User",
      targetId: user.id,
      ipAddress: ip,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles.map((r) => r.role),
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    await db.loginAttempt
      .create({ data: { email: attemptedEmail, ipAddress: ip, success: false } })
      .catch(() => undefined);

    if (!(err instanceof AppError)) {
      logger.error({ err }, "Unexpected error in /api/auth/login");
    } else if (err.code !== "VALIDATION_ERROR") {
      await writeAuditLog({
        action: "auth.login.failure",
        metadata: { email: attemptedEmail },
        ipAddress: ip,
      });
    }

    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
