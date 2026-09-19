import { NextResponse } from "next/server";
import { savePlace, unsavePlace } from "@/lib/tourist/savedPlaces";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { logger } from "@/lib/logging/logger";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    const saved = await savePlace(user!.id, params.id);
    return NextResponse.json({ saved }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST place save");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requireAuth(user);

    await unsavePlace(user!.id, params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in DELETE place save");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
