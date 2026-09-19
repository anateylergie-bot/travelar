"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PlaceDetail {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  verificationStatus: string;
  lastVerifiedAt: string | null;
  ownerUserId: string | null;
  category: { name: string };
  city: { name: string } | null;
}

const REPORT_REASONS = [
  "WRONG_PHONE",
  "CLOSED_BUSINESS",
  "WRONG_LOCATION",
  "WRONG_HOURS",
  "DUPLICATE",
  "MISLEADING_INFORMATION",
  "UNSAFE_INFORMATION",
  "INCORRECT_CATEGORY",
  "OFFENSIVE_CONTENT",
  "OTHER",
];

export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [directionsUrl, setDirectionsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");

  useEffect(() => {
    fetch(`/api/places/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.place) setPlace(data.place);
        else setError(data.error?.message ?? "Place not found.");
      })
      .catch(() => setError("Network error loading this place."));

    fetch(`/api/places/${params.id}/directions`)
      .then((res) => res.json())
      .then((data) => setDirectionsUrl(data.url ?? null))
      .catch(() => undefined);
  }, [params.id]);

  async function onSave() {
    setActionMessage(null);
    const res = await fetch(`/api/places/${params.id}/save`, { method: "POST" });
    const data = await res.json();
    setActionMessage(res.ok ? "Saved!" : data.error?.message ?? "Could not save this place.");
  }

  async function onReport(e: React.FormEvent) {
    e.preventDefault();
    setActionMessage(null);
    const res = await fetch(`/api/places/${params.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reportReason, details: reportDetails || undefined }),
    });
    const data = await res.json();
    setActionMessage(res.ok ? "Report submitted — thank you." : data.error?.message ?? "Could not submit report.");
  }

  if (error) return <main><p className="error">{error}</p></main>;
  if (!place) return <main><p>Loading…</p></main>;

  return (
    <main style={{ maxWidth: 700 }}>
      <h1>{place.name}</h1>
      <p>
        {place.category.name}
        {place.city ? ` · ${place.city.name}` : ""}
      </p>
      <p>Status: {place.verificationStatus}</p>
      {place.lastVerifiedAt && <p>Last verified: {new Date(place.lastVerifiedAt).toLocaleDateString()}</p>}
      {place.description && <p>{place.description}</p>}
      {place.address && <p>Address: {place.address}</p>}
      {place.phone && <p>Phone: {place.phone}</p>}
      {place.website && (
        <p>
          Website: <a href={place.website}>{place.website}</a>
        </p>
      )}

      <p>
        <button onClick={onSave}>Save this place</button>{" "}
        {directionsUrl && (
          <a href={directionsUrl} target="_blank" rel="noreferrer">
            <button type="button">Get directions</button>
          </a>
        )}
      </p>

      {!place.ownerUserId && (
        <p>
          <small>Are you the owner? Submit a claim via <code>POST /api/business/claims</code>.</small>
        </p>
      )}

      {actionMessage && <p>{actionMessage}</p>}

      <h2>Report incorrect information</h2>
      <form onSubmit={onReport}>
        <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Details (optional)"
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
        />
        <button type="submit">Submit report</button>
      </form>

      <p>
        <small>
          &quot;Ask AI about this place&quot; is not available yet — the AI assistant is a later phase (Section 44),
          not a stub pretending to answer.
        </small>
      </p>
    </main>
  );
}
