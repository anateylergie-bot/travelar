import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Spec Section 142: internal health checks. Phase 1 checks DB
// connectivity only — search/AI/payments/storage/queues will be added to
// this as those subsystems are built, not before (no fabricated "all
// systems operational" for things that don't exist yet).
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503 });
}
