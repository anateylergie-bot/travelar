// Spec Section 50 + DECISIONS.md D31: never fabricate an exchange rate.
// This interface exists so a real provider (e.g. exchangerate-api.com,
// Open Exchange Rates) can be plugged in later without touching callers —
// today, there is no API key configured, so the only adapter honestly
// reports that conversion is unavailable rather than guessing a rate.

export interface CurrencyConversionResult {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  asOf: Date;
  source: string;
}

export interface CurrencyProvider {
  convert(fromCurrency: string, toCurrency: string): Promise<CurrencyConversionResult>;
}

export class UnavailableCurrencyProvider implements CurrencyProvider {
  async convert(_fromCurrency: string, _toCurrency: string): Promise<CurrencyConversionResult> {
    throw new Error(
      "Currency conversion is not available - no exchange-rate provider is configured. " +
        "This is intentional: showing a fabricated or stale rate could cause real financial harm."
    );
  }
}

export const currencyProvider: CurrencyProvider = new UnavailableCurrencyProvider();
