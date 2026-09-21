export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listReports } from "@/lib/tourist/reports";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";
import type { ReportStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "reports.review");

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as ReportStatus | null) ?? "PENDING";

    const reports = await listReports(status);
    return NextResponse.json({ reports });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET admin reports");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
