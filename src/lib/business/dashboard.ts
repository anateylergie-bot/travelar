import { db } from "@/lib/db";

// Spec Section 113. Listing "views" (analytics) and "reports" are not
// included — view tracking is Phase-later analytics scope, and user
// reporting is Phase 6. Both return as empty/absent here rather than
// fabricated numbers.
export async function getBusinessDashboard(ownerUserId: string) {
  const [ownedPlaces, claims, updateRequests] = await Promise.all([
    db.place.findMany({ where: { ownerUserId }, include: { category: true, city: true } }),
    db.businessClaim.findMany({ where: { claimantUserId: ownerUserId }, orderBy: { submittedAt: "desc" } }),
    db.businessUpdateRequest.findMany({ where: { requestedByUserId: ownerUserId }, orderBy: { submittedAt: "desc" } }),
  ]);

  return { ownedPlaces, claims, updateRequests };
}
