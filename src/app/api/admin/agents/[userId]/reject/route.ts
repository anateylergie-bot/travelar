export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectAgentApplication } from "@/lib/agent/profile";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({ reason: z.string().min(1).max(500) });

export async function POST(request: Request, { params }: { params: { userId: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "agents.manage");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "A rejection reason is required.", parsed.error.flatten());

    const profile = await rejectAgentApplication(params.userId, user!.id, parsed.data.reason);

    await writeAuditLog({
      actorUserId: user!.id,
      action: "agent.reject",
      targetType: "LocalDataAgentProfile",
      targetId: params.userId,
      metadata: { reason: parsed.data.reason },
    });

    return NextResponse.json({ profile });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/admin/agents/[userId]/reject");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
