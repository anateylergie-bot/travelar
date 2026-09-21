export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { toApiErrorBody, statusForError, AppError } from "@/lib/errors/AppError";
import { requireAuth } from "@/lib/rbac/guard";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    const rawToken = cookies().get(SESSION_COOKIE_NAME)?.value;
    const user = await getUserFromSessionToken(rawToken);
    requireAuth(user);
    return NextResponse.json({ user });
  } catch (err) {
    if (!(err instanceof AppError)) {
      logger.error({ err }, "Unexpected error in /api/auth/me");
    }
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
