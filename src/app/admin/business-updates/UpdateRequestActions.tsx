"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpdateRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function review(decision: "APPROVED" | "REJECTED") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business/updates/${requestId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNotes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to review update request.");
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
      <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="button" disabled={loading} onClick={() => review("APPROVED")}>
        Approve (applies changes)
      </button>
      <button type="button" disabled={loading} onClick={() => review("REJECTED")}>
        Reject
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
