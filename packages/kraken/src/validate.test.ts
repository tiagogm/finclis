import { describe, it, expect } from "bun:test";
import { parseMonth, monthBounds } from "./validate.js";

describe("parseMonth", () => {
  it('parses "2026-01" → { month: 1, year: 2026 }', () => {
    expect(parseMonth("2026-01")).toEqual({ month: 1, year: 2026 });
  });

  it('parses "2026-1" (single digit) → { month: 1, year: 2026 }', () => {
    expect(parseMonth("2026-1")).toEqual({ month: 1, year: 2026 });
  });

  it('returns null for "invalid"', () => {
    expect(parseMonth("invalid")).toBeNull();
  });

  it('returns null for "01-2026" (wrong format)', () => {
    expect(parseMonth("01-2026")).toBeNull();
  });

  it("returns null for month 0", () => {
    expect(parseMonth("2026-0")).toBeNull();
  });

  it("returns null for month 13", () => {
    expect(parseMonth("2026-13")).toBeNull();
  });
});

describe("monthBounds", () => {
  it("returns correct Unix seconds for Jan 2026 UTC", () => {
    const { start, end, label } = monthBounds(1, 2026);
    expect(start).toBe(Math.floor(Date.UTC(2026, 0, 1) / 1000));
    expect(end).toBe(Math.floor(Date.UTC(2026, 1, 1) / 1000) - 1);
    expect(label).toBe("January 2026");
  });

  it("returns correct Unix seconds for Feb 2024 (leap year) UTC", () => {
    const { start, end } = monthBounds(2, 2024);
    expect(start).toBe(Math.floor(Date.UTC(2024, 1, 1) / 1000));
    expect(end).toBe(Math.floor(Date.UTC(2024, 2, 1) / 1000) - 1);
  });

  it("wraps December correctly", () => {
    const { start, end, label } = monthBounds(12, 2025);
    expect(start).toBe(Math.floor(Date.UTC(2025, 11, 1) / 1000));
    expect(end).toBe(Math.floor(Date.UTC(2026, 0, 1) / 1000) - 1);
    expect(label).toBe("December 2025");
  });
});
