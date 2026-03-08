import { describe, it, expect } from "bun:test";
import { validateDate, parseDateValue, parseMonth, monthBounds } from "./validate.js";

describe("validateDate", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(validateDate("2026-01-15")).toBe("2026-01-15");
  });
});

describe("parseDateValue", () => {
  it("parses YYYY-MM-DD into a UTC Date", () => {
    const d = parseDateValue("2026-03-15");
    expect(d.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });
});

describe("parseMonth", () => {
  it("parses valid YYYY-M and rejects invalid", () => {
    expect(parseMonth("2026-3")).toEqual({ month: 3, year: 2026 });
    expect(parseMonth("2025-12")).toEqual({ month: 12, year: 2025 });
    expect(parseMonth("invalid")).toBeNull();
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-0")).toBeNull();
  });
});

describe("monthBounds", () => {
  it("returns correct ISO since/before boundaries", () => {
    const bounds = monthBounds(3, 2026);
    expect(bounds.since).toBe("2026-03-01T00:00:00.000Z");
    expect(bounds.before).toBe("2026-04-01T00:00:00.000Z");
  });
});
