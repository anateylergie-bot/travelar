export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchPlaces, type SearchSort } from "@/lib/tourist/search";
import { createPlace } from "@/lib/places/placeService";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

// Public search — no auth required (spec Section 41: tourist search is a
// core unauthenticated experience). Rate-limited by IP to prevent
// scraping the whole dataset via repeated small-radius queries. Supports
// both geospatial ("nearby") and non-geospatial (browse by city/category)
// modes — see src/lib/tourist/search.ts.
export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = checkRateLimit(`places-search:${ip}`, 60, 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "Too many search requests. Please slow down.");

    const { searchParams } = new URL(request.url);
    const latRaw = searchParams.get("lat");
    const lngRaw = searchParams.get("lng");
    const sortRaw = searchParams.get("sort");

    const latitude = latRaw !== null ? Number(latRaw) : undefined;
    const longitude = lngRaw !== null ? Number(lngRaw) : undefined;

    if (latitude !== undefined && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
      throw new AppError("VALIDATION_ERROR", "lat must be a number between -90 and 90.");
    }
    if (longitude !== undefined && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
      throw new AppError("VALIDATION_ERROR", "lng must be a number between -180 and 180.");
    }

    const results = await searchPlaces({
      latitude,
      longitude,
      radiusMeters: searchParams.get("radiusMeters") ? Number(searchParams.get("radiusMeters")) : undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      cityId: searchParams.get("cityId") ?? undefined,
      nameQuery: searchParams.get("q") ?? undefined,
      verifiedOnly: searchParams.get("verifiedOnly") === "true",
      openNow: searchParams.get("openNow") === "true",
      sort: sortRaw === "distance" || sortRaw === "freshness" || sortRaw === "name" ? (sortRaw as SearchSort) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ places: results });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/places");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}

const CreatePlaceSchema = z.object({
  name: z.string().trim().min(2).max(200),
  categoryId: z.string().uuid(),
  countryId: z.string().uuid(),
  regionId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  neighborhoodId: z.string().uuid().optional(),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

// Gated to LOCAL_DATA_AGENT / FIELD_VERIFIER / MODERATOR / DATA_MANAGER /
// SUPER_ADMIN (see rbac/roles.ts). The full agent task-assignment workflow
// (spec Section 21-23) is Phase 3 — this is the direct creation endpoint
// those higher-level workflows will eventually call into.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "places.create");

    const body = await request.json().catch(() => null);
    const parsed = CreatePlaceSchema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid place data.", parsed.error.flatten());

    const result = await createPlace({ ...parsed.data, createdByUserId: user!.id });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "place.create",
      targetType: "Place",
      targetId: result.place.id,
      metadata: { name: result.place.name, duplicatesFound: result.potentialDuplicates.length },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/places");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
