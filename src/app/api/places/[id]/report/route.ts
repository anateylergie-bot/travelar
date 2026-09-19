import { NextResponse } from "next/server";
import { z } from "zod";
import { submitReport } from "@/lib/tourist/reports";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

const REASONS = [
  "WRONG_PHONE",
  "CLOSED_BUSINESS",
  "WRONG_LOCATION",
  "WRONG_HOURS",
  "DUPLICATE",
  "MISLEADING_INFORMATION",
  "UNSAFE_INFORMATION",
  "INCORRECT_CATEGORY",
  "OFFENSIVE_CONTENT",
  "OTHER",
] as const;

const Schema = z.object({
  reason: z.enum(REASONS),
  details: z.string().max(1000).optional(),
});

// Requires login (spec Section 131: spam prevention via reputation/rate
// limiting works far better with an accountable identity than anonymous
// submissions).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    const { allowed } = checkRateLimit(`report:${user!.id}`, 20, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "Too many reports submitted. Please try again later.");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid report data.", parsed.error.flatten());

    const report = await submitReport({ placeId: params.id, reporterUserId: user!.id, ...parsed.data });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "report.submit",
      targetType: "Report",
      targetId: report.id,
      metadata: { placeId: params.id, reason: parsed.data.reason },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST place report");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
