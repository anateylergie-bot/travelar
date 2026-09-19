import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveReport } from "@/lib/tourist/reports";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({ resolutionNotes: z.string().max(1000).optional() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "reports.review");

    const body = await request.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid request.", parsed.error.flatten());

    const report = await resolveReport({
      reportId: params.id,
      reviewedByUserId: user!.id,
      resolutionNotes: parsed.data.resolutionNotes,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "report.resolve",
      targetType: "Report",
      targetId: report.id,
    });

    return NextResponse.json({ report });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST report resolve");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
