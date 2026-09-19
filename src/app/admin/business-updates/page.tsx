import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import UpdateRequestActions from "./UpdateRequestActions";

export default async function AdminBusinessUpdatesPage() {
  const { allowed } = await checkPagePermission("business.updates.review");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const requests = await db.businessUpdateRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: { requestedBy: { select: { email: true, displayName: true } }, place: { select: { name: true } } },
  });

  return (
    <main>
      <h1>Pending Business Update Requests</h1>
      <p>
        <small>
          Nothing here has been applied to the place yet (spec Section 29 — moderation required). Approving writes
          one PlaceChangeHistory row per changed field.
        </small>
      </p>

      {requests.length === 0 && <p>No pending update requests.</p>}

      {requests.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #e7e5e4", padding: "0.75rem 0" }}>
          <p>
            <strong>{r.place.name}</strong> — requested by {r.requestedBy.displayName ?? r.requestedBy.email}
          </p>
          <pre style={{ background: "#f5f5f4", padding: "0.5rem", fontSize: "0.85rem" }}>
            {JSON.stringify(r.changes, null, 2)}
          </pre>
          <UpdateRequestActions requestId={r.id} />
        </div>
      ))}
    </main>
  );
}
