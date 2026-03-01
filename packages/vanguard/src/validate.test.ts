import { test, describe, expect } from "bun:test";
import { parseMonth, parseYear, monthBounds, yearBounds, formatGBP } from "./validate.js";

describe("parseMonth", () => {
  test("parses valid MM-YYYY", () => {
    expect(parseMonth("02-2026")).toEqual({ month: 2, year: 2026 });
  });

  test("parses single-digit month", () => {
    expect(parseMonth("1-2026")).toEqual({ month: 1, year: 2026 });
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
});

describe("parseYear", () => {
  test("parses valid YYYY", () => {
    expect(parseYear("2025")).toBe(2025);
  });

  test("returns null for non-numeric", () => {
    expect(parseYear("abcd")).toBeNull();
  });

  test("returns null for short year", () => {
    expect(parseYear("25")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseYear("")).toBeNull();
  });
});

describe("monthBounds", () => {
  test("february 2026 bounds", () => {
    const { fromDate, toDate } = monthBounds(2, 2026);
    expect(fromDate).toBe("2026-02-01T00:00:00.000Z");
    expect(toDate).toBe("2026-02-28T23:59:59.999Z");
  });

  test("february 2024 leap year", () => {
    const { fromDate, toDate } = monthBounds(2, 2024);
    expect(fromDate).toBe("2024-02-01T00:00:00.000Z");
    expect(toDate).toBe("2024-02-29T23:59:59.999Z");
  });

  test("december bounds", () => {
    const { fromDate, toDate } = monthBounds(12, 2025);
    expect(fromDate).toBe("2025-12-01T00:00:00.000Z");
    expect(toDate).toBe("2025-12-31T23:59:59.999Z");
  });

  test("january bounds", () => {
    const { fromDate, toDate } = monthBounds(1, 2026);
    expect(fromDate).toBe("2026-01-01T00:00:00.000Z");
    expect(toDate).toBe("2026-01-31T23:59:59.999Z");
  });
});

describe("yearBounds", () => {
  test("2025 bounds", () => {
    const { fromDate, toDate } = yearBounds(2025);
    expect(fromDate).toBe("2025-01-01T00:00:00.000Z");
    expect(toDate).toBe("2025-12-31T23:59:59.999Z");
  });

  test("2024 leap year bounds", () => {
    const { fromDate, toDate } = yearBounds(2024);
    expect(fromDate).toBe("2024-01-01T00:00:00.000Z");
    expect(toDate).toBe("2024-12-31T23:59:59.999Z");
  });
});

describe("formatGBP", () => {
  test("formats whole number", () => {
    expect(formatGBP(1000)).toBe("1,000.00");
  });

  test("formats with decimals", () => {
    expect(formatGBP(42156.78)).toBe("42,156.78");
  });

  test("formats zero", () => {
    expect(formatGBP(0)).toBe("0.00");
  });

  test("formats negative", () => {
    expect(formatGBP(-500.5)).toBe("-500.50");
  });

  test("formats large number", () => {
    expect(formatGBP(1234567.89)).toBe("1,234,567.89");
  });
});
