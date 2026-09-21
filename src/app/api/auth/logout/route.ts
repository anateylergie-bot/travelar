export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { getUserFromSessionToken } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const cookieStore = cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (rawToken) {
      const user = await getUserFromSessionToken(rawToken);
      await revokeSession(rawToken, "logout");
      if (user) {
        await writeAuditLog({ actorUserId: user.id, action: "auth.logout", targetType: "User", targetId: user.id });
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    if (!(err instanceof AppError)) {
      logger.error({ err }, "Unexpected error in /api/auth/logout");
    }
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
