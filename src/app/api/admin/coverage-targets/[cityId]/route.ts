import { NextResponse } from "next/server";
import { getCityCoverageDashboard } from "@/lib/admin/coverageTargets";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET(_request: Request, { params }: { params: { cityId: string } }) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "coverage_targets.manage");

    const rows = await getCityCoverageDashboard(params.cityId);
    return NextResponse.json({ coverage: rows });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET coverage dashboard");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
