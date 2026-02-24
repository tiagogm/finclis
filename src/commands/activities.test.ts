import { test, describe, expect } from "bun:test";
import { formatTitle, monthLabel, formatAmount } from "./activities.js";

describe("formatTitle", () => {
  test("strips strong tags and applies bold", () => {
    const result = formatTitle("<strong>Test Payment</strong>", true);
    expect(result).toBe("\x1b[1mTest Payment\x1b[0m");
  });

  test("strips green tags and applies green", () => {
    const result = formatTitle("<green>+100 GBP</green>", true);
    expect(result).toBe("\x1b[32m+100 GBP\x1b[0m");
  });

  test("strips red tags and applies red", () => {
    const result = formatTitle("<red>-50 GBP</red>", true);
    expect(result).toBe("\x1b[31m-50 GBP\x1b[0m");
  });

  test("handles mixed tags", () => {
    const result = formatTitle("<strong>Sent</strong> to <green>John</green>", true);
    expect(result).toBe("\x1b[1mSent\x1b[0m to \x1b[32mJohn\x1b[0m");
  });

  test("strips all tags when isTTY is false", () => {
    const result = formatTitle("<strong>Test Payment</strong>", false);
    expect(result).toBe("Test Payment");
  });

  test("returns plain text unchanged", () => {
    const result = formatTitle("Plain text", true);
    expect(result).toBe("Plain text");
  });
});

describe("monthLabel", () => {
  test("formats month and year", () => {
    expect(monthLabel(2, 2026)).toBe("February 2026");
  });

  test("formats january", () => {
    expect(monthLabel(1, 2026)).toBe("January 2026");
  });

  test("formats december", () => {
    expect(monthLabel(12, 2025)).toBe("December 2025");
  });
});

describe("formatAmount", () => {
  test("primary only", () => {
    expect(formatAmount("150 JPY", "")).toBe("150 JPY");
  });

  test("primary and secondary", () => {
    expect(formatAmount("500 GBP", "650 EUR")).toBe("500 GBP → 650 EUR");
  });

  test("primary with undefined secondary", () => {
    expect(formatAmount("100 USD", undefined)).toBe("100 USD");
  });
});
