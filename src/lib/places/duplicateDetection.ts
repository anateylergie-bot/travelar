// Spec Section 24: before accepting a new place, compare name, coordinates,
// phone, website, address, category, photos — surface possible duplicates,
// NEVER auto-merge. These are pure functions so they can be unit-tested
// without touching a database; the DB-backed candidate lookup lives in
// duplicateService.ts.

/** Haversine great-circle distance in meters. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius, meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Classic Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j] ?? 0;
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prevDiag
          : 1 + Math.min(prevDiag, temp, dp[j - 1] ?? 0);
      prevDiag = temp;
    }
  }
  return dp[n] ?? 0;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similarity in [0,1], 1 = identical after normalization. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/** Strips everything but digits, and a leading country/trunk-adjacent "0" is left as-is —
 *  full E.164 normalization is a Phase 2+ follow-up; this catches the common
 *  case of formatting differences (spaces, dashes, parens). */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na.length < 6 || nb.length < 6) return false;
  // Compare last 9 digits to tolerate country-code prefix differences
  // (e.g. "+233 24 xxx xxxx" vs "024 xxx xxxx").
  return na.slice(-9) === nb.slice(-9);
}

export function normalizeWebsite(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function websitesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeWebsite(a) === normalizeWebsite(b);
}

export interface DuplicateCandidateInput {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  categoryId: string;
}

export interface DuplicateSignal {
  candidateId: string;
  score: number; // 0-100, NOT a certainty — a prioritization score for human review
  reasons: string[];
  distanceMeters: number;
  nameSimilarity: number;
}

const DUPLICATE_DISTANCE_THRESHOLD_METERS = 250;
const DUPLICATE_NAME_SIMILARITY_THRESHOLD = 0.6;

/**
 * Scores one candidate against a new submission. Never returns a boolean
 * "is a duplicate" — only a score + reasons, because spec Section 24
 * explicitly forbids auto-merging uncertain matches. A human (or the
 * admin merge UI in a later phase) makes the final call.
 */
export function scoreDuplicateCandidate(
  newPlace: { name: string; latitude: number; longitude: number; phone?: string | null; website?: string | null; categoryId: string },
  candidate: DuplicateCandidateInput
): DuplicateSignal | null {
  const dist = distanceMeters(newPlace.latitude, newPlace.longitude, candidate.latitude, candidate.longitude);
  const nameSim = nameSimilarity(newPlace.name, candidate.name);

  const reasons: string[] = [];
  let score = 0;

  if (dist <= DUPLICATE_DISTANCE_THRESHOLD_METERS) {
    reasons.push(`${Math.round(dist)}m away (within ${DUPLICATE_DISTANCE_THRESHOLD_METERS}m threshold)`);
    // Closer = more weight, up to 40 points.
    score += 40 * (1 - dist / DUPLICATE_DISTANCE_THRESHOLD_METERS);
  }

  if (nameSim >= DUPLICATE_NAME_SIMILARITY_THRESHOLD) {
    reasons.push(`Name ${Math.round(nameSim * 100)}% similar`);
    score += 40 * nameSim;
  }

  if (phonesMatch(newPlace.phone, candidate.phone)) {
    reasons.push("Phone number matches");
    score += 15;
  }

  if (websitesMatch(newPlace.website, candidate.website)) {
    reasons.push("Website matches");
    score += 15;
  }

  if (newPlace.categoryId === candidate.categoryId) {
    score += 5;
  }

  // Only surface candidates with at least some meaningful signal — avoid
  // flooding review queues with every place in the same city.
  if (reasons.length === 0) return null;

  return {
    candidateId: candidate.id,
    score: Math.min(100, Math.round(score)),
    reasons,
    distanceMeters: Math.round(dist),
    nameSimilarity: Math.round(nameSim * 100) / 100,
  };
}
