"use client";

import { useState } from "react";

interface CoverageRow {
  categoryId: string;
  categoryName: string;
  target: number;
  current: number;
  verified: number;
  gap: number;
}

export default function CoverageDashboard({
  cities,
  categories,
}: {
  cities: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [targetCount, setTargetCount] = useState("");
  const [rows, setRows] = useState<CoverageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDashboard(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coverage-targets/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to load dashboard.");
        return;
      }
      setRows(data.coverage);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function onSetTarget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coverage-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId, categoryId, targetCount: Number(targetCount) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to set target.");
        return;
      }
      setTargetCount("");
      await loadDashboard(cityId);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSetTarget}>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          placeholder="Target count"
          value={targetCount}
          onChange={(e) => setTargetCount(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          Set target
        </button>
        <button type="button" disabled={loading} onClick={() => loadDashboard(cityId)}>
          View dashboard for this city
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {rows && (
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Target</th>
              <th>Current</th>
              <th>Verified</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.categoryId}>
                <td>{r.categoryName}</td>
                <td>{r.target}</td>
                <td>{r.current}</td>
                <td>{r.verified}</td>
                <td>{r.gap}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>No targets configured for this city yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
