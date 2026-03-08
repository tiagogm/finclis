import { describe, expect, test } from "bun:test";
import { parseMonth, parseYear, monthBounds, yearBounds, formatAmount } from "./validate.js";
import { baseUrl } from "./auth.js";

describe("parseMonth", () => {
  test("parses valid YYYY-MM", () => {
    expect(parseMonth("2025-03")).toEqual({ month: 3, year: 2025 });
  });
  test("parses single-digit month", () => {
    expect(parseMonth("2024-1")).toEqual({ month: 1, year: 2024 });
  });
  test("returns null for invalid format", () => {
    expect(parseMonth("03-2025")).toBeNull();
  });
  test("returns null for month 0", () => {
    expect(parseMonth("2025-0")).toBeNull();
  });
  test("returns null for month 13", () => {
    expect(parseMonth("2025-13")).toBeNull();
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
    const { toDate } = monthBounds(2, 2024);
    expect(toDate).toBe("2024-02-29T23:59:59.999Z");
  });
  test("december bounds", () => {
    const { fromDate, toDate } = monthBounds(12, 2025);
    expect(fromDate).toBe("2025-12-01T00:00:00.000Z");
    expect(toDate).toBe("2025-12-31T23:59:59.999Z");
  });
});

describe("yearBounds", () => {
  test("2025 bounds", () => {
    const { fromDate, toDate } = yearBounds(2025);
    expect(fromDate).toBe("2025-01-01T00:00:00.000Z");
    expect(toDate).toBe("2025-12-31T23:59:59.999Z");
  });
});

describe("formatAmount", () => {
  test("formats whole number", () => {
    expect(formatAmount(1000)).toBe("1,000.00");
  });
  test("formats with decimals", () => {
    expect(formatAmount(1234.56)).toBe("1,234.56");
  });
  test("formats zero", () => {
    expect(formatAmount(0)).toBe("0.00");
  });
  test("formats negative", () => {
    expect(formatAmount(-99.5)).toBe("-99.50");
  });
});

describe("baseUrl", () => {
  test("live returns live URL", () => {
    expect(baseUrl("live")).toBe("https://live.trading212.com/api/v0");
  });
  test("demo returns demo URL", () => {
    expect(baseUrl("demo")).toBe("https://demo.trading212.com/api/v0");
  });
});
