export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKeyAccess, extractBearerToken } from "@/lib/b2b/apiKeys";
import { toApiErrorBody, statusForError, AppError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET(request: Request) {
  try {
    const rawKey = extractBearerToken(request);
    await requireApiKeyAccess(rawKey, "categories.read");

    const categories = await db.category.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ categories });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/v1/categories");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
