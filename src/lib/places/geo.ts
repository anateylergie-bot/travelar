import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Spec Section 86: "do not calculate large-scale geographic searches
// entirely in application code." We push distance calculation and
// radius filtering to PostGIS (ST_DWithin/ST_Distance against a
// geography cast), which can use the GiST index created in
// prisma/manual-sql/001-postgis-and-constraints.sql. Every value below is
// passed as a bound parameter via Prisma.sql — never string-interpolated
// into the query — to avoid SQL injection (spec Section 105).

export interface NearbyPlaceResult {
  id: string;
  name: string;
  categoryId: string;
  latitude: number;
  longitude: number;
  verificationStatus: string;
  distanceMeters: number;
  openingHours: unknown;
  lastVerifiedAt: Date | null;
}

export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  categoryId?: string;
  cityId?: string;
  verifiedOnly?: boolean;
  nameQuery?: string;
  limit?: number;
}

export async function findNearbyPlaces(params: NearbySearchParams): Promise<NearbyPlaceResult[]> {
  const { latitude, longitude, radiusMeters, categoryId, cityId, verifiedOnly, nameQuery, limit = 25 } = params;

  if (latitude < -90 || latitude > 90) throw new Error("Invalid latitude");
  if (longitude < -180 || longitude > 180) throw new Error("Invalid longitude");
  if (radiusMeters <= 0 || radiusMeters > 100_000) throw new Error("radiusMeters must be between 1 and 100000");

  const verifiedStatuses = Prisma.sql`('DIGITALLY_VERIFIED','FIELD_VERIFIED','OWNER_VERIFIED','COMMUNITY_VERIFIED')`;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`ST_DWithin(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
      ${radiusMeters}
    )`,
    Prisma.sql`"verificationStatus" NOT IN ('REJECTED', 'CLOSED')`,
  ];

  if (categoryId) conditions.push(Prisma.sql`"categoryId" = ${categoryId}`);
  if (cityId) conditions.push(Prisma.sql`"cityId" = ${cityId}`);
  if (verifiedOnly) conditions.push(Prisma.sql`"verificationStatus" IN ${verifiedStatuses}`);
  if (nameQuery) conditions.push(Prisma.sql`name ILIKE ${"%" + nameQuery + "%"}`);

  const whereClause = Prisma.join(conditions, " AND ");

  const results = await db.$queryRaw<NearbyPlaceResult[]>(Prisma.sql`
    SELECT
      id,
      name,
      "categoryId",
      latitude,
      longitude,
      "verificationStatus",
      "openingHours",
      "lastVerifiedAt",
      ST_Distance(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) AS "distanceMeters"
    FROM "Place"
    WHERE ${whereClause}
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit}
  `);

  return results;
}
