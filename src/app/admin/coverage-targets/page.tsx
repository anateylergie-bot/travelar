import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import CoverageDashboard from "./CoverageDashboard";

export default async function AdminCoverageTargetsPage() {
  const { allowed } = await checkPagePermission("coverage_targets.manage");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const [cities, categories] = await Promise.all([
    db.city.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main>
      <h1>City Data Coverage Targets</h1>
      <p>
        <small>
          Target/Current/Verified/Gap are computed live from real Place records (spec Section 90) — never
          fabricated. A city with no configured targets shows nothing until you set one.
        </small>
      </p>

      <CoverageDashboard cities={cities} categories={categories} />
    </main>
  );
}
