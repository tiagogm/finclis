import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  mockGetAccounts,
  mockFetchAllTransactions,
  mockReadCachedTransactions,
  mockWriteCachedTransactions,
  registerMocks,
  captureStdout,
} from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockGetAccounts.mockReset();
    mockFetchAllTransactions.mockReset();
    mockReadCachedTransactions.mockReset();
    mockReadCachedTransactions.mockReturnValue(null);
    mockWriteCachedTransactions.mockClear();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a month, fetching live when not cached", async () => {
    mockGetAccounts.mockResolvedValue([{ balanceAmount: { amount: 1500 } }]);
    mockFetchAllTransactions.mockResolvedValue([
      {
        date: new Date("2026-08-20T00:00:00Z").getTime(),
        description: "SALARY",
        completeDescription: ["SALARY"],
        balance: 1500,
        money_in: 200,
        vtdHostCallRequired: false,
        txnId: "t2",
        completeTxnId: "t2full",
      },
    ]);

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("lloyds");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.balance.closing).toBe(1500);
    expect(parsed.transactionCount).toBe(1);
  });

  it("clamps period end to today for the current month", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().slice(0, 10);

    mockGetAccounts.mockResolvedValue([{ balanceAmount: { amount: 800 } }]);
    mockFetchAllTransactions.mockResolvedValue([]);

    await statementCommand({ month: currentMonth, json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.period.end).toBe(todayStr);
  });

  it("rejects a month that has not started yet", async () => {
    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

    const originalExit = process.exit;
    process.exit = (() => undefined) as any;
    try {
      await statementCommand({ month: nextMonth, json: true });
    } finally {
      process.exit = originalExit;
    }

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.error).toBe("unknown");
    expect(parsed.message).toContain("is in the future");
  });
});
