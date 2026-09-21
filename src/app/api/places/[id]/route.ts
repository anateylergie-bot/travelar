export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const place = await db.place.findUnique({
      where: { id: params.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        country: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        neighborhood: { select: { id: true, name: true } },
        sources: { include: { source: true } },
      },
    });

    if (!place) throw new AppError("NOT_FOUND", "Place not found.");

    return NextResponse.json({ place });
  } catch (err) {
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
