import { NextResponse } from "next/server";
import { approveAgentApplication } from "@/lib/agent/profile";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "agents.manage");

    const profile = await approveAgentApplication(params.userId, user!.id);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "agent.approve",
      targetType: "LocalDataAgentProfile",
      targetId: params.userId,
    });

    return NextResponse.json({ profile });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/agents/[userId]/approve");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
