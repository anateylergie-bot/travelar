import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import { formatMinorUnits } from "@/lib/rewards/wallet";
import PayoutActions from "./PayoutActions";

export default async function AdminPayoutsPage() {
  const { allowed } = await checkPagePermission("payouts.manage");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const payouts = await db.payout.findMany({
    where: { status: "PENDING" },
    orderBy: { requestedAt: "asc" },
    include: { user: { select: { email: true, displayName: true } } },
  });

  return (
    <main>
      <h1>Pending Payouts</h1>
      <p>
        <small>
          No payout provider is connected (see docs/DECISIONS.md D21) — this platform does not move real money.
          Mark a payout &quot;Paid&quot; only after you have completed the transfer yourself through a real channel
          (Mobile Money, bank transfer, etc.) and have a reference number to record.
        </small>
      </p>

      {payouts.length === 0 && <p>No pending payouts.</p>}

      {payouts.map((p) => (
        <div key={p.id} style={{ borderBottom: "1px solid #e7e5e4", padding: "0.75rem 0" }}>
          <p>
            <strong>{formatMinorUnits(p.amountMinorUnits, p.currency)}</strong> requested by{" "}
            {p.user.displayName ?? p.user.email} on {p.requestedAt.toISOString().slice(0, 10)}
          </p>
          <PayoutActions payoutId={p.id} />
        </div>
      ))}
    </main>
  );
}
