import { describe, it, expect } from "bun:test";
import { buildTrading212Statement } from "./statement.js";
import type { CSVTx } from "./csv.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function tx(overrides: Partial<CSVTx> = {}): CSVTx {
  return { date: "2026-08-05 10:00:00", amount: 100, action: "Deposit", type: "deposit", ...overrides };
}

describe("buildTrading212Statement", () => {
  it("derives closing from current cash and flows since period end", () => {
    const statement = buildTrading212Statement({
      period,
      currency: "GBP",
      periodTxns: [tx({ amount: 500, type: "deposit" }), tx({ amount: -50, action: "Withdrawal", type: "withdrawal" })],
      afterPeriodTxns: [tx({ date: "2026-09-05 10:00:00", amount: 20, type: "deposit" })],
      currentCashFree: 1000,
    });

    // closing = 1000 - 20 (flow after period end) = 980
    expect(statement.balance.closing).toBe(980);
    // opening = closing - netFlowDuringPeriod(500 - 50 = 450) = 530
    expect(statement.balance.opening).toBe(530);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
    expect(statement.accountType).toBe("investment");
  });

  it("sums deposits/interest/dividends as credits and withdrawals as debits", () => {
    const statement = buildTrading212Statement({
      period,
      currency: "GBP",
      periodTxns: [
        tx({ amount: 500, type: "deposit" }),
        tx({ amount: 12.5, action: "Interest", type: "interest" }),
        tx({ amount: 8, action: "Dividend", type: "dividend" }),
        tx({ amount: -50, action: "Withdrawal", type: "withdrawal" }),
      ],
      afterPeriodTxns: [],
      currentCashFree: 1000,
    });

    expect(statement.credits).toBeCloseTo(520.5, 2);
    expect(statement.debits).toBe(50);
    expect(statement.transactionCount).toBe(4);
  });

  it("maps each transaction with direction and includes the excludes-invested-capital note", () => {
    const statement = buildTrading212Statement({
      period,
      currency: "GBP",
      periodTxns: [tx({ date: "2026-08-05 10:00:00", amount: -50, action: "Withdrawal", type: "withdrawal" })],
      afterPeriodTxns: [],
      currentCashFree: 1000,
    });

    expect(statement.transactions).toEqual([
      { date: "2026-08-05", amount: 50, direction: "debit", description: "Withdrawal", currency: "GBP" },
    ]);
    expect(statement.notes).toContain("Excludes invested capital and unrealized P&L");
  });
});
