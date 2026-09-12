import { describe, it, expect } from "bun:test";
import { buildWiseStatement } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

describe("buildWiseStatement", () => {
  it("uses reported start/end balances when present", () => {
    const statement = buildWiseStatement({
      currency: "GBP",
      period,
      balanceId: 42,
      currentBalanceAmount: 1500,
      statement: {
        startOfStatementBalance: { amount: { value: 1234.56, currency: "GBP" } },
        endOfStatementBalance: { amount: { value: 1500, currency: "GBP" } },
        transactions: [
          { date: "2026-08-05T10:00:00Z", amount: { value: -3.5, currency: "GBP" }, details: { description: "Coffee shop" } },
        ],
      },
    });

    expect(statement.balance).toEqual({ opening: 1234.56, closing: 1500, type: "cash", source: "reported" });
    expect(statement.notes).toEqual([]);
  });

  it("falls back to deriving from the current balance when reported fields are missing", () => {
    const statement = buildWiseStatement({
      currency: "GBP",
      period,
      balanceId: 42,
      currentBalanceAmount: 1500,
      statement: {
        transactions: [
          { date: "2026-08-05T10:00:00Z", amount: { value: 200, currency: "GBP" }, details: { description: "Deposit" } },
          { date: "2026-08-06T10:00:00Z", amount: { value: -50, currency: "GBP" }, details: { description: "Fee" } },
        ],
      },
    });

    expect(statement.balance.closing).toBe(1500);
    expect(statement.balance.opening).toBe(1350); // 1500 - (200 - 50)
    expect(statement.balance.source).toBe("derived");
    expect(statement.notes).toContain(
      "Vendor did not return period-native balances; closing balance approximated from the current balance."
    );
  });

  it("maps transactions with direction and totals credits/debits", () => {
    const statement = buildWiseStatement({
      currency: "GBP",
      period,
      balanceId: 42,
      currentBalanceAmount: 1500,
      statement: {
        startOfStatementBalance: { amount: { value: 1000, currency: "GBP" } },
        endOfStatementBalance: { amount: { value: 1500, currency: "GBP" } },
        transactions: [
          { date: "2026-08-05T10:00:00Z", amount: { value: 600, currency: "GBP" }, details: { description: "Deposit" } },
          { date: "2026-08-06T10:00:00Z", amount: { value: -100, currency: "GBP" }, details: { type: "CARD" } },
        ],
      },
    });

    expect(statement.credits).toBe(600);
    expect(statement.debits).toBe(100);
    expect(statement.transactionCount).toBe(2);
    expect(statement.transactions).toEqual([
      { date: "2026-08-05", amount: 600, direction: "credit", description: "Deposit", currency: "GBP" },
      { date: "2026-08-06", amount: 100, direction: "debit", description: "CARD", currency: "GBP" },
    ]);
  });
});
