import { NextResponse } from "next/server";
import { getBusinessDashboard } from "@/lib/business/dashboard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    const user = await getCurrentUser();
    requireAuth(user);

    const dashboard = await getBusinessDashboard(user!.id);
    return NextResponse.json(dashboard);
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/business/dashboard");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
