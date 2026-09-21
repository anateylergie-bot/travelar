export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDirectionsUrl } from "@/lib/tourist/directions";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const place = await db.place.findUnique({ where: { id: params.id }, select: { latitude: true, longitude: true } });
    if (!place) throw new AppError("NOT_FOUND", "Place not found.");

    return NextResponse.json({ url: getDirectionsUrl(place.latitude, place.longitude) });
  } catch (err) {
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
