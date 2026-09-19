import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import EmergencyNumberForm from "./EmergencyNumberForm";

export default async function AdminEmergencyNumbersPage() {
  const { allowed } = await checkPagePermission("emergency_numbers.manage");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const [numbers, countries] = await Promise.all([
    db.emergencyNumber.findMany({ orderBy: { service: "asc" }, include: { country: { select: { name: true } } } }),
    db.country.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main>
      <h1>Emergency Numbers</h1>
      <p>
        <small>
          A source is required for every number — never enter one you have not personally confirmed against an
          authoritative source (spec Section 155). See docs/DECISIONS.md D29 for how Ghana&apos;s current numbers
          were sourced.
        </small>
      </p>

      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th>Service</th>
            <th>Number</th>
            <th>Source</th>
            <th>Last verified</th>
          </tr>
        </thead>
        <tbody>
          {numbers.map((n) => (
            <tr key={n.id}>
              <td>{n.country.name}</td>
              <td>{n.service}</td>
              <td>{n.number}</td>
              <td style={{ maxWidth: 300, fontSize: "0.85rem" }}>{n.sourceDescription}</td>
              <td>{n.lastVerifiedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add or update a number</h2>
      <EmergencyNumberForm countries={countries} />
    </main>
  );
}
