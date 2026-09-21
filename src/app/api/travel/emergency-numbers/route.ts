export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listEmergencyNumbers } from "@/lib/travel/emergencyNumbers";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");
    if (!countryId) throw new AppError("VALIDATION_ERROR", "countryId query parameter is required.");

    const numbers = await listEmergencyNumbers(countryId);
    return NextResponse.json({ emergencyNumbers: numbers });
  } catch (err) {
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
