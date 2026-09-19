import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getBusinessDashboard } from "@/lib/business/dashboard";

export default async function BusinessDashboardPage() {
  const rawToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromSessionToken(rawToken);
  if (!user) redirect("/login");

  const { ownedPlaces, claims, updateRequests } = await getBusinessDashboard(user.id);

  return (
    <main style={{ maxWidth: 900 }}>
      <h1>Business Dashboard</h1>
      <p>Signed in as {user.displayName ?? user.email}.</p>

      <h2>Your Verified Listings</h2>
      {ownedPlaces.length === 0 ? (
        <p>
          No verified listings yet. Submit a claim via <code>POST /api/business/claims</code> with the place ID
          you manage.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>City</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ownedPlaces.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category.name}</td>
                <td>{p.city?.name ?? "-"}</td>
                <td>{p.verificationStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Your Claims</h2>
      <table>
        <thead>
          <tr>
            <th>Place ID</th>
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id}>
              <td>{c.placeId}</td>
              <td>{c.status}</td>
              <td>{c.submittedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Your Update Requests</h2>
      <table>
        <thead>
          <tr>
            <th>Place ID</th>
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {updateRequests.map((r) => (
            <tr key={r.id}>
              <td>{r.placeId}</td>
              <td>{r.status}</td>
              <td>{r.submittedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        <small>
          Listing views and incorrect-information reports are not shown here yet — view analytics and the tourist
          reporting system are later phases (Section 80 / Phase 6), not fabricated numbers.
        </small>
      </p>
    </main>
  );
}
