export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getWallet, getWalletTransactions } from "@/lib/rewards/wallet";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireAuth } from "@/lib/rbac/guard";
import { AppError, toApiErrorBody, statusForError } from "@/lib/errors/AppError";
import { logger } from "@/lib/logging/logger";

// Any authenticated user can view their own wallet (it'll just be all
// zeros if they've never earned anything) — no special role required to
// look at your own balance.
export async function GET() {
  try {
    const user = await getCurrentUser();
    requireAuth(user);

    const [wallet, transactions] = await Promise.all([getWallet(user!.id), getWalletTransactions(user!.id)]);

    return NextResponse.json({ wallet, transactions });
  } catch (err) {
    if (!(err instanceof AppError)) logger.error({ err }, "Unexpected error in GET /api/agent/wallet");
    return NextResponse.json(toApiErrorBody(err), { status: statusForError(err) });
  }
}
