import { describe, it, expect } from "bun:test";
import { validateDate, parseDateValue, parseMonth, monthBounds } from "./validate.js";

describe("validateDate", () => {
  it("accepts valid DD-MM-YYYY", () => {
    expect(validateDate("15-01-2026")).toBe("15-01-2026");
  });
});

describe("parseDateValue", () => {
  it("parses DD-MM-YYYY into a UTC Date", () => {
    const d = parseDateValue("15-03-2026");
    expect(d.toISOString()).toBe("2026-03-15T00:00:00.000Z");
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
