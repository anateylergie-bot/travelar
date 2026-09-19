"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayoutActions({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function process(decision: "PAID" | "FAILED") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "PAID" ? { decision, reference } : { decision, failureReason }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to process payout.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Reference (required for PAID)"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <button type="button" disabled={loading} onClick={() => process("PAID")}>
        Mark Paid
      </button>
      <input
        type="text"
        placeholder="Failure reason (for FAILED)"
        value={failureReason}
        onChange={(e) => setFailureReason(e.target.value)}
      />
      <button type="button" disabled={loading} onClick={() => process("FAILED")}>
        Mark Failed
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
