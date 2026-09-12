import { describe, it, expect } from "bun:test";
import {
  monthToPeriod,
  resolveStatementPeriod,
  deriveClosingBalance,
  deriveOpeningBalance,
  printStatement,
  type Statement,
} from "./statement.js";

describe("monthToPeriod", () => {
  it("returns start/end bounds for a valid month", () => {
    const period = monthToPeriod("2026-08");
    expect(period).toEqual({
      month: "2026-08",
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("handles February in a leap year", () => {
    const period = monthToPeriod("2028-02");
    expect(period.end).toBe("2028-02-29");
  });

  it("throws on malformed input", () => {
    expect(() => monthToPeriod("2026-8")).toThrow('Invalid month: "2026-8". Expected YYYY-MM.');
  });

  it("throws on out-of-range month", () => {
    expect(() => monthToPeriod("2026-13")).toThrow('Invalid month: "2026-13". Expected YYYY-MM.');
  });
});

describe("resolveStatementPeriod", () => {
  it("returns the full month unchanged when it is entirely in the past", () => {
    const period = resolveStatementPeriod("2026-08", "2026-09-12");
    expect(period).toEqual({ month: "2026-08", start: "2026-08-01", end: "2026-08-31" });
  });

  it("clamps end to today when the month is still in progress", () => {
    const period = resolveStatementPeriod("2026-09", "2026-09-12");
    expect(period).toEqual({ month: "2026-09", start: "2026-09-01", end: "2026-09-12" });
  });

  it("does not clamp when today is exactly the last day of the month", () => {
    const period = resolveStatementPeriod("2026-09", "2026-09-30");
    expect(period.end).toBe("2026-09-30");
  });

  it("throws when the month has not started yet", () => {
    expect(() => resolveStatementPeriod("2026-10", "2026-09-12")).toThrow(
      'Invalid month: "2026-10" is in the future.'
    );
  });
});

describe("deriveClosingBalance", () => {
  it("subtracts flows that happened after the period end", () => {
    expect(deriveClosingBalance(1500, 50)).toBe(1450);
  });

  it("adds back a withdrawal that happened after the period end", () => {
    expect(deriveClosingBalance(1500, -50)).toBe(1550);
  });
});

describe("deriveOpeningBalance", () => {
  it("subtracts the period's net flow from the closing balance", () => {
    expect(deriveOpeningBalance(1450, 200)).toBe(1250);
  });
});

function baseStatement(overrides: Partial<Statement> = {}): Statement {
  return {
    platform: "monzo",
    account: { id: "acc_1", name: "Current Account" },
    accountType: "bank",
    period: { month: "2026-08", start: "2026-08-01", end: "2026-08-31" },
    currency: "GBP",
    balance: { opening: 1234.56, closing: 1500, type: "cash", source: "derived" },
    cashBalance: null,
    credits: 2000,
    debits: 734.56,
    transactionCount: 1,
    transactionsAvailable: true,
    transactions: [
      { date: "2026-08-05", amount: 42.1, direction: "credit", description: "Coffee shop", currency: "GBP" },
    ],
    notes: [],
    ...overrides,
  };
}

function captureLog(fn: () => void): string {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (s: string) => lines.push(s);
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines.join("\n");
}

describe("printStatement", () => {
  it("prints the header fields and transaction table", () => {
    const out = captureLog(() => printStatement(baseStatement()));
    expect(out).toContain("Platform:         monzo");
    expect(out).toContain("Opening Balance:  GBP 1,234.56");
    expect(out).toContain("Closing Balance:  GBP 1,500.00");
    expect(out).toContain("Coffee shop");
  });

  it("omits the transaction table when transactions is null", () => {
    const out = captureLog(() =>
      printStatement(baseStatement({ transactions: null, transactionsAvailable: false }))
    );
    expect(out).not.toContain("Description");
  });

  it("includes a Notes section when notes are present", () => {
    const out = captureLog(() => printStatement(baseStatement({ notes: ["Excludes invested capital"] })));
    expect(out).toContain("Excludes invested capital");
  });
});
