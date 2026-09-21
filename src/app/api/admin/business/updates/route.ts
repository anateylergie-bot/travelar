export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listUpdateRequests } from "@/lib/business/updates";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";
import type { BusinessUpdateStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "business.updates.review");

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as BusinessUpdateStatus | null) ?? "PENDING";

    const updateRequests = await listUpdateRequests(status);
    return NextResponse.json({ updateRequests });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET admin business updates");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
