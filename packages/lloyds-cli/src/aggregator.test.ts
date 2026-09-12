import { describe, it, expect } from "bun:test";
import { buildLloydsStatement, type LloydsTransaction } from "./aggregator.js";

const period = { month: "2026-08", start: "2026-08-01", end: "2026-08-31" };

function txn(overrides: Partial<LloydsTransaction> = {}): LloydsTransaction {
  return {
    date: new Date("2026-08-05T00:00:00Z").getTime(),
    description: "PAYMENT",
    completeDescription: ["PAYMENT", "ACME LTD"],
    balance: 1500,
    vtdHostCallRequired: false,
    txnId: "t1",
    completeTxnId: "t1full",
    ...overrides,
  };
}

describe("buildLloydsStatement", () => {
  it("derives opening/closing from the first/last transaction's running balance (newest-first input)", () => {
    // newest-first: latest tx has balance 1500 (closing); earliest tx had balance 1500 - moneyIn = opening
    const raw: LloydsTransaction[] = [
      txn({ txnId: "t2", date: new Date("2026-08-20T00:00:00Z").getTime(), balance: 1500, money_in: 200 }),
      txn({ txnId: "t1", date: new Date("2026-08-05T00:00:00Z").getTime(), balance: 1300, money_out: 50 }),
    ];

    const statement = buildLloydsStatement(raw, 1500, period, "arr_123");

    // earliest (last in array) had money_out=50, balance=1300 -> opening = 1300 + 50 = 1350
    expect(statement.balance.opening).toBe(1350);
    expect(statement.balance.closing).toBe(1500);
    expect(statement.balance.type).toBe("cash");
    expect(statement.balance.source).toBe("derived");
  });

  it("uses currentBalance for opening/closing when there are no transactions", () => {
    const statement = buildLloydsStatement([], 800, period, "arr_123");
    expect(statement.balance.opening).toBe(800);
    expect(statement.balance.closing).toBe(800);
    expect(statement.transactionCount).toBe(0);
    expect(statement.transactions).toEqual([]);
  });

  it("notes that the balance is not historical for an empty past month", () => {
    const statement = buildLloydsStatement([], 800, period, "arr_123");
    expect(statement.notes).toHaveLength(1);
    expect(statement.notes[0]).toContain("not a historical figure");
  });

  it("adds no balance note for an empty current month (period end clamped to today)", () => {
    const today = new Date().toISOString().slice(0, 10);
    const currentPeriod = { month: today.slice(0, 7), start: `${today.slice(0, 7)}-01`, end: today };
    const statement = buildLloydsStatement([], 800, currentPeriod, "arr_123");
    expect(statement.notes).toEqual([]);
  });

  it("excludes non-flow rows (no money_in/money_out) from the transaction list", () => {
    const raw: LloydsTransaction[] = [
      txn({ txnId: "t3", date: new Date("2026-08-25T00:00:00Z").getTime(), balance: 1500, money_in: 200, completeDescription: ["SALARY"] }),
      txn({ txnId: "t2", date: new Date("2026-08-15T00:00:00Z").getTime(), balance: 1300, completeDescription: ["STANDING ORDER", "CANCELLED"] }),
      txn({ txnId: "t1", date: new Date("2026-08-05T00:00:00Z").getTime(), balance: 1300, money_out: 50, completeDescription: ["COFFEE SHOP"] }),
    ];

    const statement = buildLloydsStatement(raw, 1500, period, "arr_123");

    expect(statement.transactionCount).toBe(2);
    expect(statement.transactions).toEqual([
      { date: "2026-08-25", amount: 200, direction: "credit", description: "SALARY", currency: "GBP" },
      { date: "2026-08-05", amount: 50, direction: "debit", description: "COFFEE SHOP", currency: "GBP" },
    ]);
    expect(statement.credits).toBe(200);
    expect(statement.debits).toBe(50);
  });

  it("sums credits/debits and maps transaction direction", () => {
    const raw: LloydsTransaction[] = [
      txn({ txnId: "t2", date: new Date("2026-08-20T00:00:00Z").getTime(), balance: 1500, money_in: 200, completeDescription: ["SALARY"] }),
      txn({ txnId: "t1", date: new Date("2026-08-05T00:00:00Z").getTime(), balance: 1300, money_out: 50, completeDescription: ["COFFEE SHOP"] }),
    ];

    const statement = buildLloydsStatement(raw, 1500, period, "arr_123");

    expect(statement.credits).toBe(200);
    expect(statement.debits).toBe(50);
    expect(statement.transactionCount).toBe(2);
    expect(statement.transactions).toEqual([
      { date: "2026-08-20", amount: 200, direction: "credit", description: "SALARY", currency: "GBP" },
      { date: "2026-08-05", amount: 50, direction: "debit", description: "COFFEE SHOP", currency: "GBP" },
    ]);
  });

  it("sets platform, account, and accountType", () => {
    const statement = buildLloydsStatement([], 800, period, "arr_123");
    expect(statement.platform).toBe("lloyds");
    expect(statement.account).toEqual({ id: "arr_123", name: "Current Account" });
    expect(statement.accountType).toBe("bank");
    expect(statement.currency).toBe("GBP");
  });
});
