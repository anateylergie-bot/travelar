import { NextResponse } from "next/server";
import { acceptTask } from "@/lib/agent/tasks";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "places.create");

    const task = await acceptTask(params.id, user!.id);

    await writeAuditLog({ actorUserId: user!.id, action: "task.accept", targetType: "Task", targetId: task.id });

    return NextResponse.json({ task });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST task accept");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
