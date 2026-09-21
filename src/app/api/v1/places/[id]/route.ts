export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKeyAccess, extractBearerToken } from "@/lib/b2b/apiKeys";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rawKey = extractBearerToken(request);
    await requireApiKeyAccess(rawKey, "places.read");

    const place = await db.place.findUnique({
      where: { id: params.id },
      include: { category: true, country: true, region: true, city: true, neighborhood: true },
    });
    if (!place) throw new AppError("NOT_FOUND", "Place not found.");

    return NextResponse.json({ place });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/v1/places/[id]");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
