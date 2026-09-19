// Spec Section 37: "Design a payment abstraction layer. Do not hard-code
// one provider." See DECISIONS.md D21 for what the current (manual)
// implementation does and does not do.

export interface PayoutRequest {
  payoutId: string;
  userId: string;
  amountMinorUnits: number;
  currency: string;
}

export interface PayoutResult {
  success: boolean;
  reference?: string;
  failureReason?: string;
}

export interface PayoutProvider {
  /**
   * Attempts to disburse funds. The MANUAL adapter always returns
   * success:false with a reason explaining a human must process this —
   * it never fabricates a successful transfer (spec Section 153's "no
   * fake security" principle, applied to payments: no fake payment
   * confirmation either).
   */
  processPayout(request: PayoutRequest): Promise<PayoutResult>;
}
