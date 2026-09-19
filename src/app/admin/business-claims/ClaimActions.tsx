"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClaimActions({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function review(decision: "APPROVED" | "REJECTED") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business/claims/${claimId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision === "REJECTED" ? { decision, rejectionReason: reason } : { decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to review claim.");
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
      <button type="button" disabled={loading} onClick={() => review("APPROVED")}>
        Approve
      </button>
      <input
        type="text"
        placeholder="Rejection reason (required to reject)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button type="button" disabled={loading} onClick={() => review("REJECTED")}>
        Reject
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
