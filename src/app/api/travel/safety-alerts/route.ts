export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listActiveSafetyAlerts } from "@/lib/travel/safetyAlerts";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");
    if (!countryId) throw new AppError("VALIDATION_ERROR", "countryId query parameter is required.");
    const cityId = searchParams.get("cityId") ?? undefined;

    const alerts = await listActiveSafetyAlerts({ countryId, cityId });
    return NextResponse.json({ alerts });
  } catch (err) {
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
