export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listAvailableTasks, listAgentTasks } from "@/lib/agent/tasks";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";
import type { TaskType } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "places.create"); // same gate as agent-capable roles

    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get("cityId") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const type = (searchParams.get("type") as TaskType | null) ?? undefined;
    const mine = searchParams.get("mine") === "true";

    const tasks = mine
      ? await listAgentTasks(user!.id)
      : await listAvailableTasks({ cityId, categoryId, type });

    return NextResponse.json({ tasks });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/agent/tasks");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
