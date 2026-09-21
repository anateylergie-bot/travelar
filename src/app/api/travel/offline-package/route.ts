export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildOfflinePackage } from "@/lib/travel/offlinePackage";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requireAuth(user);

    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");
    if (!countryId) throw new AppError("VALIDATION_ERROR", "countryId query parameter is required.");

    const pkg = await buildOfflinePackage(user!.id, countryId);
    return NextResponse.json(pkg);
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET offline package");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
