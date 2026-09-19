"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SERVICES = ["GENERAL", "POLICE", "AMBULANCE", "FIRE", "OTHER"];

export default function EmergencyNumberForm({ countries }: { countries: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [countryId, setCountryId] = useState(countries[0]?.id ?? "");
  const [service, setService] = useState(SERVICES[0]);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/travel/emergency-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId, service, number, label: label || undefined, sourceDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to save.");
        return;
      }
      setNumber("");
      setLabel("");
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
      <select value={service} onChange={(e) => setService(e.target.value)}>
        {SERVICES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input type="text" placeholder="Number" value={number} onChange={(e) => setNumber(e.target.value)} required />
      <input type="text" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input
        type="text"
        placeholder="Source (required — where did this number come from?)"
        value={sourceDescription}
        onChange={(e) => setSourceDescription(e.target.value)}
        required
        style={{ width: 350 }}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
