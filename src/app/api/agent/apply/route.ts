import { NextResponse } from "next/server";
import { z } from "zod";
import { applyAsAgent } from "@/lib/agent/profile";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  city: z.string().max(100).optional(),
  area: z.string().max(100).optional(),
  preferredLanguage: z.string().max(50).optional(),
  availability: z.string().max(200).optional(),
  experience: z.string().max(1000).optional(),
});

// Any authenticated user can apply — applying does NOT grant the
// LOCAL_DATA_AGENT role (see DECISIONS.md D15). An admin/data manager
// must approve via POST /api/admin/agents/:userId/approve.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid application data.", parsed.error.flatten());

    const profile = await applyAsAgent({ userId: user!.id, ...parsed.data });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "agent.apply",
      targetType: "LocalDataAgentProfile",
      targetId: user!.id,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/agent/apply");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
