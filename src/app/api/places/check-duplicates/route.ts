export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { findPotentialDuplicates } from "@/lib/places/duplicateService";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { logger } from "@/lib/logging/logger";

const Schema = z.object({
  name: z.string().trim().min(2).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().max(30).optional(),
  website: z.string().url().optional(),
  categoryId: z.string().uuid(),
});

// Same permission as creating a place — this is meant to run BEFORE
// submission (spec Section 24: "possible existing place found 120m away"),
// so anyone who can create a place can check for duplicates first.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "places.create");

    const body = await request.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid input.", parsed.error.flatten());

    const signals = await findPotentialDuplicates(parsed.data);

    return NextResponse.json({ potentialDuplicates: signals });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST /api/places/check-duplicates");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
