import { NextResponse } from "next/server";
import { listClaims } from "@/lib/business/claims";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";
import type { BusinessClaimStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    requirePermission(user, "business.claims.review");

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as BusinessClaimStatus | null) ?? "PENDING";

    const claims = await listClaims(status);
    return NextResponse.json({ claims });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET admin business claims");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
