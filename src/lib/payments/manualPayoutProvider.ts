import type { PayoutProvider, PayoutRequest, PayoutResult } from "./PayoutProvider";

// See DECISIONS.md D21. This adapter does not move any money. It exists so
// the rest of the codebase (payout request/processing workflow, ledger,
// audit log) is fully real and functional, while being explicit that
// actual fund disbursement happens outside this system today — a Finance
// Administrator must complete the transfer via whatever channel (mobile
// money, bank transfer) and then record the outcome via the admin API.
export class ManualPayoutProvider implements PayoutProvider {
  async processPayout(_request: PayoutRequest): Promise<PayoutResult> {
    return {
      success: false,
      failureReason:
        "No automated payout provider is configured. A Finance Administrator must complete this transfer manually and record the result.",
    };
  }
}

export const payoutProvider: PayoutProvider = new ManualPayoutProvider();
