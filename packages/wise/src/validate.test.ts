import { test, describe, expect } from "bun:test";
import { parseMonth, monthBounds } from "./validate.js";

describe("parseMonth", () => {
  test("parses valid YYYY-MM", () => {
    expect(parseMonth("2026-02")).toEqual({ month: 2, year: 2026 });
  });

  test("parses single-digit month", () => {
    expect(parseMonth("2026-1")).toEqual({ month: 1, year: 2026 });
  });

  test("returns null for invalid format", () => {
    expect(parseMonth("02-2026")).toBeNull();
  });

  test("returns null for month 0", () => {
    expect(parseMonth("2026-00")).toBeNull();
  });

  test("returns null for month 13", () => {
    expect(parseMonth("2026-13")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseMonth("")).toBeNull();
  });
});

describe("monthBounds", () => {
  test("february 2026 bounds", () => {
    const { since, until } = monthBounds(2, 2026);
    expect(since).toBe("2026-02-01T00:00:00.000Z");
    expect(until).toBe("2026-02-28T23:59:59.999Z");
  });

  test("february 2024 leap year", () => {
    const { since, until } = monthBounds(2, 2024);
    expect(since).toBe("2024-02-01T00:00:00.000Z");
    expect(until).toBe("2024-02-29T23:59:59.999Z");
  });

  test("december bounds", () => {
    const { since, until } = monthBounds(12, 2025);
    expect(since).toBe("2025-12-01T00:00:00.000Z");
    expect(until).toBe("2025-12-31T23:59:59.999Z");
  });

  test("january bounds", () => {
    const { since, until } = monthBounds(1, 2026);
    expect(since).toBe("2026-01-01T00:00:00.000Z");
    expect(until).toBe("2026-01-31T23:59:59.999Z");
  });
});
