"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIVITIES = [
  "NEW_PLACE_APPROVED",
  "FIELD_VERIFICATION_APPROVED",
  "UPDATE_APPROVED",
  "CLOSURE_CONFIRMED",
  "CONTACT_VERIFICATION_APPROVED",
  "LOCATION_VERIFICATION_APPROVED",
  "PHOTO_TASK_APPROVED",
];

export default function RewardRuleForm() {
  const router = useRouter();
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rewards/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity,
          amountMinorUnits: Math.round(Number(amount) * 100),
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to save reward rule.");
        return;
      }
      setAmount("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <select value={activity} onChange={(e) => setActivity(e.target.value)}>
        {ACTIVITIES.map((a) => (
          <option key={a} value={a}>
            {a.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Amount (major units, e.g. 5.00)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Currency"
        value={currency}
        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        maxLength={3}
        style={{ width: 60 }}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save rule"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
