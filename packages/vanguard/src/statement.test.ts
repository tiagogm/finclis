import { describe, it, expect } from "bun:test";
import { buildVanguardStatement } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function monthData(overrides: Partial<any> = {}) {
  return {
    Month: "Aug 2026",
    PerformanceDetail: {
      OpeningValue: { Amount: 10000 },
      ClosingValue: { Amount: 10500 },
      PaymentsIn: { Amount: 300 },
      PaymentsOut: { Amount: 50 },
      ...overrides,
    },
  };
}

describe("buildVanguardStatement", () => {
  it("uses reported opening/closing portfolio value", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.balance).toEqual({ opening: 10000, closing: 10500, type: "portfolio", source: "reported" });
    expect(statement.accountType).toBe("investment");
    expect(statement.currency).toBe("GBP");
  });

  it("maps PaymentsIn/PaymentsOut to credits/debits", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.credits).toBe(300);
    expect(statement.debits).toBe(50);
  });

  it("sets cashBalance as a current snapshot, and no transaction list", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.cashBalance).toEqual({ asOf: "2026-09-12", amount: 250 });
    expect(statement.transactions).toBeNull();
    expect(statement.transactionsAvailable).toBe(false);
    expect(statement.transactionCount).toBe(0);
  });

  it("includes both required notes", () => {
    const statement = buildVanguardStatement({
      period,
      monthData: monthData(),
      cashBalanceAmount: 250,
      today: "2026-09-12",
    });

    expect(statement.notes).toContain("Balance is total portfolio value (cash + holdings), not cash alone.");
    expect(statement.notes).toContain(
      "Cash balance is a current snapshot, not period-accurate — no historical cash-only endpoint exists."
    );
  });

  it("throws when no data exists for the requested period", () => {
    expect(() =>
      buildVanguardStatement({ period, monthData: undefined, cashBalanceAmount: 0, today: "2026-09-12" })
    ).toThrow("No performance data found for 2026-08");
  });
});
