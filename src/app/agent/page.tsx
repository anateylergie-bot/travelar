import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AgentDashboardPage() {
  const rawToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  const user = await getUserFromSessionToken(rawToken);
  if (!user) redirect("/login");

  const profile = await db.localDataAgentProfile.findUnique({ where: { userId: user.id } });

  if (!profile) {
    return (
      <main>
        <h1>Become a Local Data Agent</h1>
        <p>
          You haven&apos;t applied yet. Use <code>POST /api/agent/apply</code> to submit an application —
          there&apos;s no form here yet (Phase 3 ships the API; the application UI is a follow-up).
        </p>
      </main>
    );
  }

  if (profile.status !== "APPROVED") {
    return (
      <main>
        <h1>Agent application status</h1>
        <p>
          Status: <strong>{profile.status}</strong>
        </p>
        {profile.status === "REJECTED" && profile.rejectionReason && <p>Reason: {profile.rejectionReason}</p>}
        {profile.status === "PENDING_APPROVAL" && <p>An admin will review your application.</p>}
      </main>
    );
  }

  const [reputation, assignedTasks, openTasksCount, wallet] = await Promise.all([
    db.agentReputation.findUnique({ where: { userId: user.id } }),
    db.task.findMany({
      where: { assignedAgentId: user.id },
      orderBy: { assignedAt: "desc" },
      take: 20,
      include: { submissions: true },
    }),
    db.task.count({ where: { status: "OPEN" } }),
    db.wallet.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <main style={{ maxWidth: 900 }}>
      <h1>Agent Dashboard</h1>
      <p>Welcome, {user.displayName ?? user.email}.</p>

      <h2>Your Reputation</h2>
      <table>
        <tbody>
          <tr>
            <th>Level</th>
            <td>{reputation?.level ?? "LEVEL_1_NEW"}</td>
          </tr>
          <tr>
            <th>Accuracy</th>
            <td>{reputation ? `${Math.round(reputation.accuracyScore * 100)}%` : "N/A — no reviewed submissions yet"}</td>
          </tr>
          <tr>
            <th>Completed Tasks</th>
            <td>{reputation?.completedTasksCount ?? 0}</td>
          </tr>
        </tbody>
      </table>

      <h2>Your Earnings</h2>
      <table>
        <tbody>
          <tr>
            <th>Pending</th>
            <td>{wallet ? `${wallet.currency} ${(wallet.pendingMinorUnits / 100).toFixed(2)}` : "0.00"}</td>
          </tr>
          <tr>
            <th>Available (approved)</th>
            <td>{wallet ? `${wallet.currency} ${(wallet.approvedMinorUnits / 100).toFixed(2)}` : "0.00"}</td>
          </tr>
          <tr>
            <th>Paid</th>
            <td>{wallet ? `${wallet.currency} ${(wallet.paidMinorUnits / 100).toFixed(2)}` : "0.00"}</td>
          </tr>
        </tbody>
      </table>
      <p>
        <small>
          Pending earnings become available after a Finance Administrator confirms them (separate from data-quality
          review). Request a payout via <code>POST /api/agent/wallet/payout-request</code> once you have an
          available balance.
        </small>
      </p>

      <h2>Your Tasks</h2>
      <p>{openTasksCount} open task(s) available city-wide (see <code>GET /api/agent/tasks</code>).</p>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Title</th>
            <th>Status</th>
            <th>Submissions</th>
          </tr>
        </thead>
        <tbody>
          {assignedTasks.map((t) => (
            <tr key={t.id}>
              <td>{t.type}</td>
              <td>{t.title}</td>
              <td>{t.status}</td>
              <td>{t.submissions.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
