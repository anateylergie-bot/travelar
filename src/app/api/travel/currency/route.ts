import { NextResponse } from "next/server";
import { currencyProvider } from "@/lib/currency/CurrencyProvider";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) throw new AppError("VALIDATION_ERROR", "from and to currency codes are required.");

    const result = await currencyProvider.convert(from, to);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
    }
    // The UnavailableCurrencyProvider throws a plain Error by design —
    // surfaced here as a clear, honest 503, never a fabricated rate.
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: (err as Error).message } },
      { status: 503 }
    );
  }
}
