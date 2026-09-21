export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { submitClaim } from "@/lib/business/claims";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  placeId: z.string().uuid(),
  justification: z.string().max(1000).optional(),
  evidenceDescription: z.string().max(2000).optional(),
});

// Any authenticated user can submit a claim — the BUSINESS_OWNER role is
// only granted on approval (mirrors D15's agent-application pattern).
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    const { allowed } = checkRateLimit(`business-claim:${user!.id}`, 10, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "Too many claim submissions. Please try again later.");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid claim data.", parsed.error.flatten());

    const claim = await submitClaim({ claimantUserId: user!.id, ...parsed.data });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "business_claim.submit",
      targetType: "BusinessClaim",
      targetId: claim.id,
      metadata: { placeId: parsed.data.placeId },
    });

    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/business/claims");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
