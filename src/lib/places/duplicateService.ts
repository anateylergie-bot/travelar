import { db } from "@/lib/db";
import { findNearbyPlaces } from "./geo";
import { scoreDuplicateCandidate, type DuplicateSignal } from "./duplicateDetection";

const CANDIDATE_SEARCH_RADIUS_METERS = 500; // wider than the scoring threshold, so
// borderline cases (e.g. 300m apart with an identical name) still surface.

export interface NewPlaceInput {
  name: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  categoryId: string;
}

/**
 * Finds and scores potential duplicates for a place someone is about to
 * submit. Returns signals sorted by score, descending. Spec Section 24:
 * this is advisory only — nothing here rejects or merges anything.
 */
export async function findPotentialDuplicates(newPlace: NewPlaceInput): Promise<DuplicateSignal[]> {
  const nearby = await findNearbyPlaces({
    latitude: newPlace.latitude,
    longitude: newPlace.longitude,
    radiusMeters: CANDIDATE_SEARCH_RADIUS_METERS,
    limit: 50,
  });

  if (nearby.length === 0) return [];

  const candidateIds = nearby.map((p) => p.id);
  const fullCandidates = await db.place.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, name: true, latitude: true, longitude: true, phone: true, website: true, categoryId: true },
  });

  const signals: DuplicateSignal[] = [];
  for (const candidate of fullCandidates) {
    const signal = scoreDuplicateCandidate(newPlace, candidate);
    if (signal) signals.push(signal);
  }

  return signals.sort((a, b) => b.score - a.score);
}
