"use client";

import { useEffect, useState } from "react";

interface EmergencyNumber {
  service: string;
  number: string;
  label: string | null;
  sourceDescription: string;
}

interface SafetyAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
}

// Hardcoded to Ghana's country ID lookup by ISO code at load time, since
// this page has no location-detection UI yet — a real "detect my
// country" flow is future work; this is a functional starting point.
export default function EmergencyPage() {
  const [numbers, setNumbers] = useState<EmergencyNumber[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/geography/countries")
      .then((res) => res.json())
      .then(async (data) => {
        const ghana = data.countries?.find((c: { isoCode2: string }) => c.isoCode2 === "GH");
        if (!ghana) return;

        const [numbersRes, alertsRes] = await Promise.all([
          fetch(`/api/travel/emergency-numbers?countryId=${ghana.id}`).then((r) => r.json()),
          fetch(`/api/travel/safety-alerts?countryId=${ghana.id}`).then((r) => r.json()),
        ]);
        setNumbers(numbersRes.emergencyNumbers ?? []);
        setAlerts(alertsRes.alerts ?? []);
      })
      .catch(() => undefined);
  }, []);

  function shareLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not available on this device/browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const url = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        setLocationStatus(`Your location: ${url}`);
      },
      () => setLocationStatus("Could not get your location — check permissions."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <main style={{ maxWidth: 500, background: "#fff5f5" }}>
      <h1 style={{ color: "#b3261e" }}>EMERGENCY</h1>
      <p>
        <small>
          Emergency availability and response times vary by location. These numbers are sourced from public
          government/directory information and periodically re-checked — always call for genuine emergencies only.
        </small>
      </p>

      {alerts.length > 0 && (
        <div style={{ border: "1px solid #b3261e", padding: "0.5rem", marginBottom: "1rem" }}>
          <h2>Active Safety Alerts</h2>
          {alerts.map((a) => (
            <div key={a.id}>
              <strong>{a.severity}: {a.title}</strong>
              <p>{a.description}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {numbers.map((n) => (
          <a key={n.service} href={`tel:${n.number.replace(/\s/g, "")}`}>
            <button type="button" style={{ width: "100%", fontSize: "1.2rem" }}>
              {n.label ?? n.service}: {n.number}
            </button>
          </a>
        ))}
      </div>

      {numbers.length === 0 && <p>No emergency numbers loaded for this country yet.</p>}

      <p>
        <button onClick={shareLocation}>Share my location</button>
      </p>
      {locationStatus && <p>{locationStatus}</p>}
    </main>
  );
}
