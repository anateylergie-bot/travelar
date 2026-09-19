import { NextResponse } from "next/server";
import { listPhrases } from "@/lib/travel/phrasebook";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const phrases = await listPhrases(category);
  return NextResponse.json({ phrases });
}
