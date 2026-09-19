import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import SafetyAlertForm from "./SafetyAlertForm";

export default async function AdminSafetyAlertsPage() {
  const { allowed } = await checkPagePermission("safety_alerts.manage");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const [alerts, countries, cities] = await Promise.all([
    db.safetyAlert.findMany({
      orderBy: { startsAt: "desc" },
      take: 50,
      include: { country: { select: { name: true } }, city: { select: { name: true } } },
    }),
    db.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.city.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main>
      <h1>Safety Alerts</h1>
      <p>
        <small>
          Only publish information from a reliable, verifiable source (spec Section 52) — never a rumor. A source is
          required for every alert.
        </small>
      </p>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Scope</th>
            <th>Started</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              <td>{a.title}</td>
              <td>{a.severity}</td>
              <td>{a.city ? `${a.city.name}, ${a.country.name}` : `${a.country.name} (country-wide)`}</td>
              <td>{a.startsAt.toISOString().slice(0, 10)}</td>
              <td>{a.expiresAt ? a.expiresAt.toISOString().slice(0, 10) : "No expiry set"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Publish a new alert</h2>
      <SafetyAlertForm countries={countries} cities={cities} />
    </main>
  );
}
