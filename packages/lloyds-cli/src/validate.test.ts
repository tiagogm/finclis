import { test, describe, expect } from "bun:test";
import { parseMonth, isPastMonth, formatGBP } from "./validate.js";

describe("parseMonth", () => {
  test("parses valid MM-YYYY", () => {
    expect(parseMonth("02-2026")).toEqual({ month: 2, year: 2026, key: "2026-02" });
  });

  test("parses single-digit month", () => {
    expect(parseMonth("1-2026")).toEqual({ month: 1, year: 2026, key: "2026-01" });
  });

  test("zero-pads key", () => {
    expect(parseMonth("3-2025")?.key).toBe("2025-03");
  });

  test("returns null for invalid format", () => {
    expect(parseMonth("2026-02")).toBeNull();
  });

  test("returns null for month 0", () => {
    expect(parseMonth("00-2026")).toBeNull();
  });

  test("returns null for month 13", () => {
    expect(parseMonth("13-2026")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseMonth("")).toBeNull();
  });

  test("returns null for non-numeric input", () => {
    expect(parseMonth("ab-2026")).toBeNull();
  });
});

describe("isPastMonth", () => {
  test("past year returns true", () => {
    expect(isPastMonth(2020, 1)).toBe(true);
  });

  test("current month returns false", () => {
    const now = new Date();
    expect(isPastMonth(now.getFullYear(), now.getMonth() + 1)).toBe(false);
  });

  test("future month returns false", () => {
    expect(isPastMonth(2099, 12)).toBe(false);
  });

  test("previous month same year returns true", () => {
    const now = new Date();
    const prevMonth = now.getMonth(); // 0-indexed current month = 1-indexed previous month
    if (prevMonth > 0) {
      expect(isPastMonth(now.getFullYear(), prevMonth)).toBe(true);
    }
  });
});

describe("formatGBP", () => {
  test("formats whole number", () => {
    expect(formatGBP(1000)).toBe("1,000.00");
  });

  test("formats with decimals", () => {
    expect(formatGBP(42.5)).toBe("42.50");
  });

  test("formats zero", () => {
    expect(formatGBP(0)).toBe("0.00");
  });

  test("formats negative", () => {
    expect(formatGBP(-500.5)).toBe("-500.50");
  });
});
