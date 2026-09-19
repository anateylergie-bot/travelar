import { checkPagePermission } from "@/lib/auth/pagePermission";
import { db } from "@/lib/db";
import { taskTypeForReportReason } from "@/lib/tourist/reports";
import ReportActions from "./ReportActions";

export default async function AdminReportsPage() {
  const { allowed } = await checkPagePermission("reports.review");
  if (!allowed) return <main><p>You do not have permission to view this page.</p></main>;

  const reports = await db.report.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { reporter: { select: { email: true, displayName: true } }, place: { select: { name: true } } },
  });

  return (
    <main>
      <h1>Pending Tourist Reports</h1>
      <p>
        <small>
          Creating a verification task hands this to a Local Data Agent — the same task/submission/review pipeline
          as any other field task (spec Section 68). Some reasons (duplicates, offensive content) have no task
          mapping and can only be dismissed here.
        </small>
      </p>

      {reports.length === 0 && <p>No pending reports.</p>}

      {reports.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #e7e5e4", padding: "0.75rem 0" }}>
          <p>
            <strong>{r.place.name}</strong> — {r.reason.replace(/_/g, " ").toLowerCase()} — reported by{" "}
            {r.reporter.displayName ?? r.reporter.email}
          </p>
          {r.details && <p>Details: {r.details}</p>}
          <ReportActions reportId={r.id} canCreateTask={taskTypeForReportReason(r.reason) !== null} />
        </div>
      ))}
    </main>
  );
}
