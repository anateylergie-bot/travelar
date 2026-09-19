import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import { findNearbyPlaces } from "@/lib/places/geo";
import { isOpenNow, getDefaultTimezoneOffsetMinutes, type OpeningHours } from "./openingHours";

// Spec Section 41. Two modes: geospatial (lat/lng given - the "NEARBY"
// experience) and non-geospatial (browsing by city/category without
// location, e.g. planning a trip before arriving). "TOP RATED" is
// deliberately not offered - see DECISIONS.md D28.
export type SearchSort = "distance" | "freshness" | "name";

export interface SearchParams {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  categoryId?: string;
  cityId?: string;
  nameQuery?: string;
  verifiedOnly?: boolean;
  openNow?: boolean;
  sort?: SearchSort;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  categoryId: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  lastVerifiedAt: Date | null;
  distanceMeters: number | null;
  openNow: boolean | null;
}

export async function searchPlaces(params: SearchParams): Promise<SearchResultItem[]> {
  const limit = Math.min(params.limit ?? 25, 100);
  const hasLocation = params.latitude !== undefined && params.longitude !== undefined;

  let results: SearchResultItem[];

  if (hasLocation) {
    const nearby = await findNearbyPlaces({
      latitude: params.latitude!,
      longitude: params.longitude!,
      radiusMeters: params.radiusMeters ?? 2000,
      categoryId: params.categoryId,
      cityId: params.cityId,
      verifiedOnly: params.verifiedOnly,
      nameQuery: params.nameQuery,
      limit: params.openNow ? Math.min(limit * 3, 150) : limit, // over-fetch since openNow is a post-filter
    });

    results = nearby.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      latitude: p.latitude,
      longitude: p.longitude,
      verificationStatus: p.verificationStatus,
      lastVerifiedAt: p.lastVerifiedAt,
      distanceMeters: p.distanceMeters,
      openNow: isOpenNow(p.openingHours as OpeningHours | null, new Date(), getDefaultTimezoneOffsetMinutes()),
    }));
  } else {
    if (!params.categoryId && !params.cityId && !params.nameQuery) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Provide latitude/longitude for nearby search, or at least one of categoryId/cityId/nameQuery for a non-geospatial search."
      );
    }

    const verifiedStatuses = ["DIGITALLY_VERIFIED", "FIELD_VERIFIED", "OWNER_VERIFIED", "COMMUNITY_VERIFIED"] as const;

    const rows = await db.place.findMany({
      where: {
        categoryId: params.categoryId,
        cityId: params.cityId,
        name: params.nameQuery ? { contains: params.nameQuery, mode: "insensitive" } : undefined,
        verificationStatus: params.verifiedOnly ? { in: [...verifiedStatuses] } : { notIn: ["REJECTED", "CLOSED"] },
      },
      take: params.openNow ? Math.min(limit * 3, 150) : limit,
      orderBy: params.sort === "name" ? { name: "asc" } : { lastVerifiedAt: "desc" },
    });

    results = rows.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      latitude: p.latitude,
      longitude: p.longitude,
      verificationStatus: p.verificationStatus,
      lastVerifiedAt: p.lastVerifiedAt,
      distanceMeters: null,
      openNow: isOpenNow(p.openingHours as OpeningHours | null, new Date(), getDefaultTimezoneOffsetMinutes()),
    }));
  }

  if (params.openNow) {
    results = results.filter((r) => r.openNow === true);
  }

  if (params.sort === "freshness") {
    results = [...results].sort((a, b) => {
      const aTime = a.lastVerifiedAt?.getTime() ?? 0;
      const bTime = b.lastVerifiedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  } else if (params.sort === "name") {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  }
  // "distance" sort is already the default order from findNearbyPlaces
  // when a location is given; for non-geospatial mode there is no
  // distance to sort by, so it silently falls back to freshness order.

  return results.slice(0, limit);
}
