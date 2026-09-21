export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { submitTask } from "@/lib/agent/submissions";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requirePermission } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { assertSameOrigin } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logging/logger";

function parseBool(value: FormDataEntryValue | null): boolean | undefined {
  if (value === null) return undefined;
  return value === "true";
}

function parseFloatOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// Accepts multipart/form-data so a single request can carry the checklist,
// notes, GPS reading, proposed place data (for NEW_PLACE tasks), and one
// or more photo files — matching the real mobile submission flow (spec
// Section 25: "Evidence: Photo, Notes, Timestamp, GPS coordinates").
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    requirePermission(user, "places.create");

    const formData = await request.formData();

    const photoFiles = formData.getAll("photos").filter((v): v is File => v instanceof File);
    const photos = await Promise.all(
      photoFiles.map(async (file) => ({
        buffer: Buffer.from(await file.arrayBuffer()),
        filename: file.name,
        mimeType: file.type,
      }))
    );

    const proposedPlaceDataRaw = formData.get("proposedPlaceData");
    let proposedPlaceData: Record<string, unknown> | undefined;
    if (typeof proposedPlaceDataRaw === "string" && proposedPlaceDataRaw.length > 0) {
      try {
        proposedPlaceData = JSON.parse(proposedPlaceDataRaw);
      } catch {
        throw new AppError("VALIDATION_ERROR", "proposedPlaceData must be valid JSON.");
      }
    }

    const submission = await submitTask({
      taskId: params.id,
      agentUserId: user!.id,
      checklist: {
        placeExists: parseBool(formData.get("placeExists")),
        nameMatches: parseBool(formData.get("nameMatches")),
        locationMatches: parseBool(formData.get("locationMatches")),
        appearsOperational: parseBool(formData.get("appearsOperational")),
        contactVerified: parseBool(formData.get("contactVerified")),
        openingInfoChecked: parseBool(formData.get("openingInfoChecked")),
      },
      notes: (formData.get("notes") as string | null) ?? undefined,
      gpsLat: parseFloatOrUndefined(formData.get("gpsLat")),
      gpsLng: parseFloatOrUndefined(formData.get("gpsLng")),
      gpsAccuracyMeters: parseFloatOrUndefined(formData.get("gpsAccuracyMeters")),
      proposedPlaceData,
      photos,
    });

    await writeAuditLog({
      actorUserId: user!.id,
      action: "task.submit",
      targetType: "TaskSubmission",
      targetId: submission.id,
      metadata: { taskId: params.id, photoCount: photos.length },
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in POST task submit");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
