import { describe, it, expect } from "vitest";
import { isOpenNow, type OpeningHours } from "@/lib/tourist/openingHours";

describe("isOpenNow", () => {
  it("returns null when no opening hours are known at all", () => {
    expect(isOpenNow(null, new Date())).toBeNull();
    expect(isOpenNow(undefined, new Date())).toBeNull();
  });

  it("returns null for a day not present in the schedule (unknown, not closed)", () => {
    const hours: OpeningHours = { mon: { open: "08:00", close: "18:00" } };
    // 2024-01-02 is a Tuesday (UTC) — not present in `hours`.
    const tuesday = new Date("2024-01-02T10:00:00Z");
    expect(isOpenNow(hours, tuesday, 0)).toBeNull();
  });

  it("returns false for a day explicitly marked closed (null)", () => {
    const hours: OpeningHours = { sun: null };
    const sunday = new Date("2024-01-07T10:00:00Z");
    expect(isOpenNow(hours, sunday, 0)).toBe(false);
  });

  it("returns true when the current time falls within a normal same-day window", () => {
    const hours: OpeningHours = { mon: { open: "08:00", close: "18:00" } };
    const mondayNoon = new Date("2024-01-01T12:00:00Z"); // 2024-01-01 is a Monday
    expect(isOpenNow(hours, mondayNoon, 0)).toBe(true);
  });

  it("returns false just before opening and just after closing", () => {
    const hours: OpeningHours = { mon: { open: "08:00", close: "18:00" } };
    const beforeOpen = new Date("2024-01-01T07:59:00Z");
    const afterClose = new Date("2024-01-01T18:00:00Z");
    expect(isOpenNow(hours, beforeOpen, 0)).toBe(false);
    expect(isOpenNow(hours, afterClose, 0)).toBe(false);
  });

  it("handles an overnight window correctly (e.g. 20:00-02:00)", () => {
    const hours: OpeningHours = { fri: { open: "20:00", close: "02:00" } };
    const fridayNight = new Date("2024-01-05T22:00:00Z"); // Friday 22:00
    expect(isOpenNow(hours, fridayNight, 0)).toBe(true);
  });

  it("returns null for malformed time strings rather than a false claim", () => {
    const hours: OpeningHours = { mon: { open: "not-a-time", close: "18:00" } };
    const monday = new Date("2024-01-01T12:00:00Z");
    expect(isOpenNow(hours, monday, 0)).toBeNull();
  });

  it("treats a zero-length window as closed", () => {
    const hours: OpeningHours = { mon: { open: "09:00", close: "09:00" } };
    const monday = new Date("2024-01-01T09:00:00Z");
    expect(isOpenNow(hours, monday, 0)).toBe(false);
  });

  it("applies a non-zero timezone offset correctly", () => {
    // UTC 23:30 with a +60 minute offset (e.g. West Africa Time variants)
    // becomes 00:30 local the next day.
    const hours: OpeningHours = { tue: { open: "00:00", close: "06:00" } };
    // 2024-01-01 (Mon) 23:30 UTC + 60min offset -> Tue 00:30 local
    const lateMonday = new Date("2024-01-01T23:30:00Z");
    expect(isOpenNow(hours, lateMonday, 60)).toBe(true);
  });
});
