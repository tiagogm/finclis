import { describe, it, expect } from "bun:test";
import { validateDate, parseMonth, monthBounds } from "./validate.js";

describe("validateDate", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(validateDate("2026-01-15")).toBe("2026-01-15");
  });
});

describe("parseMonth", () => {
  it("parses valid M-YYYY and rejects invalid", () => {
    expect(parseMonth("3-2026")).toEqual({ month: 3, year: 2026 });
    expect(parseMonth("12-2025")).toEqual({ month: 12, year: 2025 });
    expect(parseMonth("invalid")).toBeNull();
    expect(parseMonth("13-2026")).toBeNull();
    expect(parseMonth("0-2026")).toBeNull();
  });
});

describe("monthBounds", () => {
  it("returns correct ISO since/before boundaries", () => {
    const bounds = monthBounds(3, 2026);
    expect(bounds.since).toBe("2026-03-01T00:00:00.000Z");
    expect(bounds.before).toBe("2026-04-01T00:00:00.000Z");
  });
});
