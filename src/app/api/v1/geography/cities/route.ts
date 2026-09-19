import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKeyAccess, extractBearerToken } from "@/lib/b2b/apiKeys";
import { toApiErrorBody, statusForError, AppError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET(request: Request) {
  try {
    const rawKey = extractBearerToken(request);
    await requireApiKeyAccess(rawKey, "geography.read");

    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get("regionId") ?? undefined;

    const cities = await db.city.findMany({ where: regionId ? { regionId } : undefined, orderBy: { name: "asc" } });
    return NextResponse.json({ cities });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/v1/geography/cities");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
