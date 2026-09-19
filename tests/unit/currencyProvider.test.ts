import { describe, it, expect } from "vitest";
import { currencyProvider } from "@/lib/currency/CurrencyProvider";

describe("currencyProvider (no fabricated exchange rates - D31)", () => {
  it("always rejects rather than returning a guessed rate", async () => {
    await expect(currencyProvider.convert("USD", "GHS")).rejects.toThrow(/not available/i);
  });

  it("rejects regardless of which currencies are requested", async () => {
    await expect(currencyProvider.convert("EUR", "JPY")).rejects.toThrow();
    await expect(currencyProvider.convert("GHS", "GHS")).rejects.toThrow();
  });
});
