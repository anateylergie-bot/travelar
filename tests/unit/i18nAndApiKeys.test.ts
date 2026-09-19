import { describe, it, expect } from "vitest";
import { t, isSupportedLocale } from "@/lib/i18n/strings";
import { extractBearerToken } from "@/lib/b2b/apiKeys";

describe("t (i18n string lookup)", () => {
  it("returns the English string for a known key", () => {
    expect(t("explore.title")).toBe("Explore");
  });

  it("falls back to the key itself for an unknown key, never throwing", () => {
    expect(t("some.made.up.key")).toBe("some.made.up.key");
  });

  it("falls back to English for an unsupported locale argument", () => {
    // @ts-expect-error - deliberately passing an unsupported locale to prove the fallback
    expect(t("explore.title", "fr")).toBe("Explore");
  });
});

describe("isSupportedLocale", () => {
  it("accepts en", () => {
    expect(isSupportedLocale("en")).toBe(true);
  });

  it("rejects anything else, honestly reflecting D35's English-only scope", () => {
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale("tw")).toBe(false);
  });
});

describe("extractBearerToken", () => {
  function makeRequest(authHeader?: string): Request {
    return new Request("https://example.com", {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
  }

  it("extracts the token from a well-formed Bearer header", () => {
    expect(extractBearerToken(makeRequest("Bearer abc123"))).toBe("abc123");
  });

  it("returns null when there is no Authorization header", () => {
    expect(extractBearerToken(makeRequest())).toBeNull();
  });

  it("returns null for a non-Bearer scheme", () => {
    expect(extractBearerToken(makeRequest("Basic abc123"))).toBeNull();
  });

  it("returns null for an empty Bearer value", () => {
    expect(extractBearerToken(makeRequest("Bearer "))).toBeNull();
  });
});
