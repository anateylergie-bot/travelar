import { NextResponse } from "next/server";
import { completeTrainingModule } from "@/lib/agent/training";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    const completion = await completeTrainingModule(user!.id, params.id);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "training.module.complete",
      targetType: "TrainingModule",
      targetId: params.id,
    });

    return NextResponse.json({ completion }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST training complete");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
