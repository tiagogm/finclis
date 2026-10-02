import { describe, it, expect } from "bun:test";
import { buildKrakenStatement, type LedgerEntry } from "./statement.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    time: 1785542400, // 2026-08-01T00:00:00Z — within August 2026
    type: "deposit",
    asset: "ZUSD",
    amount: "500.0000",
    fee: "0.0000",
    balance: "1500.0000",
    refid: "REF1",
    ...overrides,
  };
}

describe("buildKrakenStatement", () => {
  it("derives closing from current balance and flows since period end", () => {
    const statement = buildKrakenStatement({
      period,
      assetCode: "ZUSD",
      periodEntries: [["L1", entry({ amount: "500.0000" })], ["L2", entry({ amount: "-100.0000", type: "withdrawal" })]],
      afterEntries: [["L3", entry({ amount: "50.0000" })]],
      currentBalance: 2000,
    });

    // closing = 2000 - 50 (flow after period end) = 1950
    expect(statement.balance.closing).toBe(1950);
    // opening = closing - netFlowDuringPeriod(500 - 100 = 400) = 1550
    expect(statement.balance.opening).toBe(1550);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
    expect(statement.accountType).toBe("exchange");
  });

  it("excludes trades from totals and the transaction list", () => {
    const statement = buildKrakenStatement({
      period,
      assetCode: "ZUSD",
      periodEntries: [
        ["L1", entry({ amount: "500.0000", type: "deposit" })],
        ["L2", entry({ amount: "-10.0000", type: "trade" })],
      ],
      afterEntries: [],
      currentBalance: 2000,
    });

    expect(statement.credits).toBe(500);
    expect(statement.transactionCount).toBe(1);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.notes).toContain("Trades excluded — funding (deposits/withdrawals) only");
  });

  it("maps deposit/withdrawal entries with direction", () => {
    const statement = buildKrakenStatement({
      period,
      assetCode: "XXBT",
      periodEntries: [["L1", entry({ time: 1786272000, amount: "-0.5000", type: "withdrawal", asset: "XXBT", refid: "REF2" })]],
      afterEntries: [],
      currentBalance: 1,
    });

    expect(statement.transactions).toEqual([
      { date: "2026-08-09", amount: 0.5, direction: "debit", description: "withdrawal (REF2)", currency: "XXBT" },
    ]);
  });
});
