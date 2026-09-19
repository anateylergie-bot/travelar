"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SEVERITIES = ["INFO", "ADVISORY", "WARNING"];

export default function SafetyAlertForm({
  countries,
  cities,
}: {
  countries: Array<{ id: string; name: string }>;
  cities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [countryId, setCountryId] = useState(countries[0]?.id ?? "");
  const [cityId, setCityId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(SEVERITIES[0]);
  const [sourceDescription, setSourceDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/travel/safety-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId,
          cityId: cityId || undefined,
          title,
          description,
          severity,
          sourceDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to create alert.");
        return;
      }
      setTitle("");
      setDescription("");
      setSourceDescription("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <select value={countryId} onChange={(e) => setCountryId(e.target.value)}>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
        <option value="">(country-wide)</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        style={{ width: 350 }}
      />
      <input
        type="text"
        placeholder="Source (required)"
        value={sourceDescription}
        onChange={(e) => setSourceDescription(e.target.value)}
        required
        style={{ width: 350 }}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Publishing…" : "Publish alert"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
