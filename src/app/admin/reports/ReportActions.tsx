"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportActions({ reportId, canCreateTask }: { reportId: string; canCreateTask: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function review(decision: "CREATE_VERIFICATION_TASK" | "DISMISS") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, resolutionNotes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to review report.");
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
      {canCreateTask && (
        <button type="button" disabled={loading} onClick={() => review("CREATE_VERIFICATION_TASK")}>
          Create verification task
        </button>
      )}
      <button type="button" disabled={loading} onClick={() => review("DISMISS")}>
        Dismiss
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
