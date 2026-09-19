import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewSubmission } from "@/lib/agent/review";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "NEEDS_MORE_INFO"]),
  reviewNotes: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "tasks.review");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid review decision.", parsed.error.flatten());

    const submission = await reviewSubmission({
      submissionId: params.id,
      reviewedByUserId: user!.id,
      decision: parsed.data.decision,
      reviewNotes: parsed.data.reviewNotes,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "submission.review",
      targetType: "TaskSubmission",
      targetId: submission.id,
      metadata: { decision: parsed.data.decision },
    });

    return NextResponse.json({ submission });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST submission review");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
