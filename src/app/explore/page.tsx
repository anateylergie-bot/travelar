"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  return (
    <Suspense fallback={<main style={{ maxWidth: 700 }}><p>Loading…</p></main>}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [cityId, setCityId] = useState(searchParams.get("cityId") ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(
    async (params: { q?: string; cityId?: string; categoryId?: string }) => {
      setError(null);
      setLoading(true);
      setSearched(true);
      try {
        const usp = new URLSearchParams();
        if (params.q) usp.set("q", params.q);
        if (params.cityId) usp.set("cityId", params.cityId);
        if (params.categoryId) usp.set("categoryId", params.categoryId);
        const res = await fetch(`/api/places?${usp.toString()}`);
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
    },
    []
  );

  // Supports arriving from the homepage's quick-action chips
  // (?category=<slug>) or a direct query (?q=...&cityId=...) — resolves
  // the category slug to an ID via the existing public categories
  // endpoint, then runs the search automatically.
  useEffect(() => {
    const categorySlug = searchParams.get("category");
    const initialQuery = searchParams.get("q") ?? "";
    const initialCityId = searchParams.get("cityId") ?? "";

    if (!categorySlug && !initialQuery && !initialCityId) return;

    if (categorySlug) {
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
          const match = data.categories?.find((c: { slug: string; id: string }) => c.slug === categorySlug);
          setCategoryId(match?.id ?? null);
          runSearch({ q: initialQuery, cityId: initialCityId, categoryId: match?.id });
        })
        .catch(() => runSearch({ q: initialQuery, cityId: initialCityId }));
    } else {
      runSearch({ q: initialQuery, cityId: initialCityId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch({ q: query, cityId, categoryId: categoryId ?? undefined });
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

