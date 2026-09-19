import { NextResponse } from "next/server";
import { z } from "zod";
import { createTask } from "@/lib/agent/tasks";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  type: z.enum([
    "NEW_PLACE",
    "UPDATE",
    "FIELD_VERIFICATION",
    "CLOSURE",
    "CONTACT_VERIFICATION",
    "LOCATION_VERIFICATION",
    "PHOTO_TASK",
  ]),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(2000).optional(),
  placeId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "tasks.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid task data.", parsed.error.flatten());

    const task = await createTask({
      ...parsed.data,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      createdByUserId: user!.id,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "task.create",
      targetType: "Task",
      targetId: task.id,
      metadata: { type: task.type },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/tasks");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
