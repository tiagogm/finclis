import { describe, it, expect } from "bun:test";
import { formatMoney } from "./format.js";

describe("formatMoney", () => {
  it("formats pence to currency string and handles 0/negative", () => {
    expect(formatMoney(123456)).toBe("GBP 1,234.56");
    expect(formatMoney(0)).toBe("GBP 0.00");
    expect(formatMoney(-500)).toBe("GBP -5.00");
    expect(formatMoney(99, "EUR")).toBe("EUR 0.99");
  });
});
