export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listTrainingModules } from "@/lib/agent/training";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { toApiErrorBody, statusForError, AppError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

// Requires login (not public) since training content is only relevant to
// people applying/working as agents — but any authenticated user can view
// it (someone considering applying should be able to preview it first).
export async function GET() {
  try {
    const user = await getCurrentUser();
    requireAuth(user);

    const modules = await listTrainingModules();
    return NextResponse.json({ modules });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/training/modules");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
