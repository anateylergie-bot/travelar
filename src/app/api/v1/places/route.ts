export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/tourist/search";
import { requireApiKeyAccess, extractBearerToken } from "@/lib/b2b/apiKeys";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

// Spec Section 60/61: versioned, API-key-authenticated external surface.
// Deliberately read-only and a subset of the internal /api/places
// capability (no report/save/create actions here) — see DECISIONS.md D33.
export async function GET(request: Request) {
  try {
    const rawKey = extractBearerToken(request);
    await requireApiKeyAccess(rawKey, "places.read");

    const { searchParams } = new URL(request.url);
    const latRaw = searchParams.get("lat");
    const lngRaw = searchParams.get("lng");

    const results = await searchPlaces({
      latitude: latRaw !== null ? Number(latRaw) : undefined,
      longitude: lngRaw !== null ? Number(lngRaw) : undefined,
      radiusMeters: searchParams.get("radiusMeters") ? Number(searchParams.get("radiusMeters")) : undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      cityId: searchParams.get("cityId") ?? undefined,
      nameQuery: searchParams.get("q") ?? undefined,
      verifiedOnly: searchParams.get("verifiedOnly") === "true",
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ places: results });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/v1/places");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
