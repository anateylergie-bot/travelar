import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  nameSimilarity,
  normalizePhone,
  phonesMatch,
  normalizeWebsite,
  websitesMatch,
  scoreDuplicateCandidate,
} from "@/lib/places/duplicateDetection";

describe("distanceMeters", () => {
  it("returns ~0 for identical coordinates", () => {
    expect(distanceMeters(6.6885, -1.6244, 6.6885, -1.6244)).toBeCloseTo(0, 1);
  });

  it("returns a plausible distance for two known Kumasi-area points ~1km apart", () => {
    // Roughly 0.009 degrees latitude ~ 1000m
    const d = distanceMeters(6.6885, -1.6244, 6.6975, -1.6244);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });
});

describe("nameSimilarity", () => {
  it("returns 1 for identical names", () => {
    expect(nameSimilarity("ABC Guest House", "ABC Guest House")).toBe(1);
  });

  it("is case- and punctuation-insensitive", () => {
    expect(nameSimilarity("ABC Guest House", "abc guest house!")).toBe(1);
  });

  it("returns a high score for a minor typo", () => {
    expect(nameSimilarity("ABC Guest House", "ABC Gest House")).toBeGreaterThan(0.85);
  });

  it("returns a low score for unrelated names", () => {
    expect(nameSimilarity("ABC Guest House", "Zenith Bank Branch")).toBeLessThan(0.4);
  });
});

describe("phone normalization and matching", () => {
  it("strips formatting characters", () => {
    expect(normalizePhone("+233 (24) 123-4567")).toBe("233241234567");
  });

  it("matches numbers differing only by country-code prefix", () => {
    expect(phonesMatch("+233241234567", "0241234567")).toBe(true);
  });

  it("does not match clearly different numbers", () => {
    expect(phonesMatch("0241234567", "0209876543")).toBe(false);
  });

  it("does not match when either value is missing", () => {
    expect(phonesMatch(null, "0241234567")).toBe(false);
    expect(phonesMatch(undefined, undefined)).toBe(false);
  });
});

describe("website normalization and matching", () => {
  it("treats http/https and www as equivalent", () => {
    expect(websitesMatch("https://www.example.com/", "http://example.com")).toBe(true);
  });

  it("does not match different domains", () => {
    expect(websitesMatch("https://example.com", "https://example.org")).toBe(false);
  });
});

describe("scoreDuplicateCandidate", () => {
  const base = {
    name: "ABC Guest House",
    latitude: 6.6885,
    longitude: -1.6244,
    phone: "0241234567",
    website: "https://abcguesthouse.com",
    categoryId: "cat-1",
  };

  it("returns null when there is no meaningful signal at all", () => {
    const result = scoreDuplicateCandidate(base, {
      id: "far-away",
      name: "Totally Different Place",
      latitude: 5.55,
      longitude: -0.2,
      phone: "0209999999",
      website: "https://unrelated.com",
      categoryId: "cat-2",
    });
    expect(result).toBeNull();
  });

  it("scores a near-identical nearby place highly", () => {
    const result = scoreDuplicateCandidate(base, {
      id: "close-match",
      name: "ABC Guest Hse",
      latitude: 6.6886,
      longitude: -1.6245,
      phone: "0241234567",
      website: "https://abcguesthouse.com",
      categoryId: "cat-1",
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(70);
    expect(result!.reasons.length).toBeGreaterThan(1);
  });

  it("gives a moderate score for name-only match far away", () => {
    const result = scoreDuplicateCandidate(base, {
      id: "same-name-far",
      name: "ABC Guest House",
      latitude: 5.55, // Accra, far from Kumasi
      longitude: -0.2,
      phone: null,
      website: null,
      categoryId: "cat-1",
    });
    expect(result).not.toBeNull();
    // Name match alone should not reach the "high confidence" threshold used
    // in placeService.ts (70), since a chain business can share a name.
    expect(result!.score).toBeLessThan(70);
  });

  it("never returns a score above 100", () => {
    const result = scoreDuplicateCandidate(base, {
      id: "exact",
      name: base.name,
      latitude: base.latitude,
      longitude: base.longitude,
      phone: base.phone,
      website: base.website,
      categoryId: base.categoryId,
    });
    expect(result!.score).toBeLessThanOrEqual(100);
  });
});
