"use client";

import { useState } from "react";
import Link from "next/link";

interface SearchResult {
  id: string;
  name: string;
  verificationStatus: string;
  distanceMeters: number | null;
  openNow: boolean | null;
}

const VERIFICATION_LABELS: Record<string, string> = {
  DIGITALLY_VERIFIED: "🔵 Digitally Verified",
  FIELD_VERIFIED: "🟢 Field Verified",
  OWNER_VERIFIED: "🟢 Owner Verified",
  COMMUNITY_VERIFIED: "🟢 Community Verified",
  DRAFT: "⚠ Unverified",
  SUBMITTED: "⚠ Unverified",
  UNDER_REVIEW: "⚠ Unverified",
  REQUIRES_UPDATE: "🟡 Needs Update",
};

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [cityId, setCityId] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (cityId) params.set("cityId", cityId);
      const res = await fetch(`/api/places?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Search failed.");
        setResults([]);
        return;
      }
      setResults(data.places);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 700 }}>
      <h1>Explore</h1>
      <form onSubmit={onSearch}>
        <input type="text" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input
          type="text"
          placeholder="City ID (optional — see /api/admin/geography/cities)"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {searched && !loading && results.length === 0 && !error && <p>No places found. Try a different search.</p>}

      {results.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Distance</th>
              <th>Open now</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/places/${r.id}`}>{r.name}</Link>
                </td>
                <td>{VERIFICATION_LABELS[r.verificationStatus] ?? r.verificationStatus}</td>
                <td>{r.distanceMeters !== null ? `${Math.round(r.distanceMeters)}m` : "—"}</td>
                <td>{r.openNow === null ? "Unknown" : r.openNow ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <small>
          This is a minimal, functional search — real place data only, no fabricated results. A full map view
          requires a Maps provider integration (spec Section 42), not yet configured.
        </small>
      </p>
    </main>
  );
}
