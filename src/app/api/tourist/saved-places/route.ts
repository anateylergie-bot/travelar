export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listSavedPlaces } from "@/lib/tourist/savedPlaces";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    const user = await getCurrentUser();
    requireAuth(user);

    const savedPlaces = await listSavedPlaces(user!.id);
    return NextResponse.json({ savedPlaces });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET saved places");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
