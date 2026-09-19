import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import ClaimActions from "./ClaimActions";

export default async function AdminBusinessClaimsPage() {
  const { allowed } = await checkPagePermission("business.claims.review");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const claims = await db.businessClaim.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: { claimant: { select: { email: true, displayName: true } }, place: { select: { name: true } } },
  });

  return (
    <main>
      <h1>Pending Business Claims</h1>
      <p>
        <small>
          No identity documents are collected (see docs/DECISIONS.md D22) — judge the evidence description on its
          merits before approving. Approval grants BUSINESS_OWNER and marks the place OWNER_VERIFIED immediately.
        </small>
      </p>

      {claims.length === 0 && <p>No pending claims.</p>}

      {claims.map((c) => (
        <div key={c.id} style={{ borderBottom: "1px solid #e7e5e4", padding: "0.75rem 0" }}>
          <p>
            <strong>{c.place.name}</strong> claimed by {c.claimant.displayName ?? c.claimant.email}
          </p>
          {c.justification && <p>Justification: {c.justification}</p>}
          {c.evidenceDescription && <p>Evidence: {c.evidenceDescription}</p>}
          <ClaimActions claimId={c.id} />
        </div>
      ))}
    </main>
  );
}
