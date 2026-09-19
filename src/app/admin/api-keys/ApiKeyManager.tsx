"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SCOPES = ["places.read", "categories.read", "geography.read"];

export default function ApiKeyManager() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [org, setOrg] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["places.read"]);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewRawKey(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, organizationName: org || undefined, scopes: selectedScopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create key.");
        return;
      }
      setNewRawKey(data.rawKey);
      setLabel("");
      setOrg("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={onCreate}>
        <input type="text" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <input
          type="text"
          placeholder="Organization (optional)"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
        />
        {SCOPES.map((scope) => (
          <label key={scope} style={{ marginRight: "0.75rem" }}>
            <input
              type="checkbox"
              checked={selectedScopes.includes(scope)}
              onChange={() => toggleScope(scope)}
            />{" "}
            {scope}
          </label>
        ))}
        <button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create key"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {newRawKey && (
        <p style={{ background: "#fff9db", padding: "0.75rem", border: "1px solid #e0c419" }}>
          <strong>Save this key now — it will never be shown again:</strong>
          <br />
          <code>{newRawKey}</code>
        </p>
      )}
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const router = useRouter();
  async function revoke() {
    await fetch(`/api/admin/api-keys/${id}/revoke`, { method: "POST" });
    router.refresh();
  }
  return (
    <button type="button" onClick={revoke}>
      Revoke
    </button>
  );
}
