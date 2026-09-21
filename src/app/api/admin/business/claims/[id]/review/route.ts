export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewClaim } from "@/lib/business/claims";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "business.claims.review");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid review decision.", parsed.error.flatten());

    const claim = await reviewClaim({
      claimId: params.id,
      reviewedByUserId: user!.id,
      decision: parsed.data.decision,
      rejectionReason: parsed.data.rejectionReason,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "business_claim.review",
      targetType: "BusinessClaim",
      targetId: claim.id,
      metadata: { decision: parsed.data.decision },
    });

    return NextResponse.json({ claim });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST business claim review");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
