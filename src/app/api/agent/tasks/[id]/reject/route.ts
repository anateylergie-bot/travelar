export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectTask } from "@/lib/agent/tasks";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({ reason: z.string().min(1).max(500) });

// Spec Section 22/91: agents may reject any assigned task (unsafe area,
// unwilling, etc.) with no reputation penalty — see DECISIONS.md D14.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "places.create");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "A reason is required to reject a task.", parsed.error.flatten());

    const task = await rejectTask(params.id, user!.id, parsed.data.reason);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "task.reject_by_agent",
      targetType: "Task",
      targetId: task.id,
      metadata: { reason: parsed.data.reason },
    });

    return NextResponse.json({ task });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST task reject");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
