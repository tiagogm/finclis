import { describe, it, expect } from "bun:test";
import { buildMonzoStatement } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function tx(overrides: Partial<any> = {}) {
  return {
    id: "tx_1",
    created: "2026-08-05T10:00:00Z",
    amount: 4210,
    currency: "GBP",
    description: "Coffee shop",
    ...overrides,
  };
}

describe("buildMonzoStatement", () => {
  it("derives opening/closing balance from current balance and flows", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [tx({ amount: 4210 }), tx({ id: "tx_2", amount: -1000 })],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 5000,
      isCurrentPeriod: false,
    });

    // closing = 150000 - 5000 = 145000 -> 1450.00
    expect(statement.balance.closing).toBe(1450);
    // net flow during period = 4210 - 1000 = 3210 -> opening = 1450 - 32.10 = 1417.90
    expect(statement.balance.opening).toBeCloseTo(1417.9, 2);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
  });

  it("sums credits and debits separately, in pounds", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [tx({ amount: 4210 }), tx({ id: "tx_2", amount: -1000 })],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 0,
      isCurrentPeriod: false,
    });

    expect(statement.credits).toBeCloseTo(42.1, 2);
    expect(statement.debits).toBeCloseTo(10, 2);
    expect(statement.transactionCount).toBe(2);
  });

  it("maps each transaction with direction and pounds amount", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [tx({ amount: -1000, description: "Refund" })],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 0,
      isCurrentPeriod: false,
    });

    expect(statement.transactions).toEqual([
      { date: "2026-08-05", amount: 10, direction: "debit", description: "Refund", currency: "GBP" },
    ]);
    expect(statement.transactionsAvailable).toBe(true);
  });

  it("adds an in-progress note for the current period", () => {
    const statement = buildMonzoStatement({
      accountId: "acc_1",
      period,
      currency: "GBP",
      periodTransactions: [],
      currentBalancePence: 150000,
      flowsSincePeriodEndPence: 0,
      isCurrentPeriod: true,
    });

    expect(statement.notes).toContain("Period is still in progress; closing balance reflects the account as of now.");
  });
});
