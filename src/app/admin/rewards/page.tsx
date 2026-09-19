import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import { formatMinorUnits } from "@/lib/rewards/wallet";
import RewardRuleForm from "./RewardRuleForm";

export default async function AdminRewardsPage() {
  const { allowed } = await checkPagePermission("rewards.manage");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const rules = await db.rewardRule.findMany({ orderBy: { activity: "asc" } });

  return (
    <main>
      <h1>Reward Rules</h1>
      <p>
        <small>
          No amount is ever hard-coded — every payment traces back to one of these rules at the moment a submission
          is approved. An activity with no active rule here pays nothing (spec Section 34).
        </small>
      </p>

      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Amount</th>
            <th>Active</th>
            <th>Last updated</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.activity.replace(/_/g, " ").toLowerCase()}</td>
              <td>{formatMinorUnits(r.amountMinorUnits, r.currency)}</td>
              <td>{r.active ? "Yes" : "No"}</td>
              <td>{r.updatedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={4}>No reward rules configured yet — agents earn nothing until you add one.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Set or update a rule</h2>
      <RewardRuleForm />
    </main>
  );
}
