// Spec Section 87 (multi-language support). See DECISIONS.md D35: this
// module is real and tested, but is NOT yet wired into any existing UI
// page — retrofitting it into already-working, already-verified pages
// purely to demonstrate the architecture was judged not worth the risk
// of touching working code without the ability to visually re-verify it.
// Adding a new page, or a deliberate future pass over existing ones,
// should use this module rather than hardcoded strings.

export const SUPPORTED_LOCALES = ["en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Only a representative slice of real strings actually used elsewhere in
// this codebase — not an exhaustive, padded-out dictionary invented for
// its own sake.
const STRINGS: Record<Locale, Record<string, string>> = {
  en: {
    "explore.title": "Explore",
    "explore.searchPlaceholder": "Search by name",
    "explore.noResults": "No places found. Try a different search.",
    "place.save": "Save this place",
    "place.getDirections": "Get directions",
    "place.reportIncorrect": "Report incorrect information",
    "place.claimPrompt": "Are you the owner? Submit a claim.",
    "emergency.title": "EMERGENCY",
    "emergency.shareLocation": "Share my location",
    "emergency.disclaimer":
      "Emergency availability and response times vary by location. Always call for genuine emergencies only.",
  },
};

export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  const dict = STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
  return dict[key] ?? STRINGS[DEFAULT_LOCALE][key] ?? key; // fall back to the key itself, never throw for missing strings
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
