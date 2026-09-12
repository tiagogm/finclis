import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockMonzoGet, mockRequireSession, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

function monthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockMonzoGet.mockReset();
    // Other test files in this package call mockRequireSession.mockReset(),
    // which wipes its base implementation (not just call history) — it's a
    // process-global mock shared across every file via mock.module(). Set it
    // explicitly here so this file doesn't depend on running before those
    // files do (file execution order isn't guaranteed and differs by OS).
    mockRequireSession.mockReset();
    mockRequireSession.mockResolvedValue({
      access_token: "test-token",
      refresh_token: "test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      account_id: "acc_test123",
    });
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a past month", async () => {
    // Always compute "last month" relative to now so this test never becomes
    // a time bomb as `isOldRange`'s 90-day window shifts past a hardcoded date.
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = monthString(lastMonthDate);
    const sinceSubstring = `since=${lastMonth}-01`;
    const txCreated = `${lastMonth}-05T10:00:00Z`;

    mockMonzoGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/balance")) {
        return { balance: 150000, currency: "GBP" };
      }
      if (path.startsWith("/transactions")) {
        // First call: period range (since=<lastMonth>-01, before=<lastMonth>-end) -> one transaction.
        // Second call: since=period end -> no more transactions (flows after period = 0).
        if (path.includes(sinceSubstring)) {
          return { transactions: [{ id: "tx_1", created: txCreated, amount: 4210, currency: "GBP", description: "Coffee shop" }] };
        }
        return { transactions: [] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    await statementCommand({ month: lastMonth, json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("monzo");
    expect(parsed.period.month).toBe(lastMonth);
    expect(parsed.transactionCount).toBe(1);
    expect(parsed.balance.closing).toBe(1500);
  });

  it("outputs a Statement object for the current month with no trailing fetch", async () => {
    const now = new Date();
    const currentMonth = monthString(now);
    const sinceSubstring = `since=${currentMonth}-01`;
    const txCreated = `${currentMonth}-02T09:00:00Z`;

    mockMonzoGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/balance")) {
        return { balance: 200000, currency: "GBP" };
      }
      if (path.startsWith("/transactions")) {
        if (path.includes(sinceSubstring)) {
          return { transactions: [{ id: "tx_2", created: txCreated, amount: -1500, currency: "GBP", description: "Groceries" }] };
        }
        // The current-period branch must never fetch the trailing
        // "flows since period end" range, since flows are hardcoded to 0.
        throw new Error(`Unexpected trailing fetch for current period: ${path}`);
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    // No --month passed: defaults to the current month.
    await statementCommand({ json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("monzo");
    expect(parsed.period.month).toBe(currentMonth);
    expect(parsed.transactionCount).toBe(1);
    expect(parsed.balance.closing).toBe(2000);
    expect(parsed.notes.join(" ")).toMatch(/in progress/i);

    // The period end must be clamped to today, not the full calendar month.
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(parsed.period.end).toBe(todayStr);

    // Only the period-transactions call and the balance call should have happened.
    expect(mockMonzoGet).toHaveBeenCalledTimes(2);
  });

  it("throws a clear error for a month older than 90 days with no cache", async () => {
    const now = new Date();
    // 4 calendar months back is comfortably beyond the 90-day cache-gating window.
    const oldDate = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const oldMonth = monthString(oldDate);

    // No mock for /transactions or /balance needed: the command must throw
    // before making any network call, once loadCache() returns null (no
    // cache file exists on disk for this month in the test environment).
    mockMonzoGet.mockImplementation(async (path: string) => {
      throw new Error(`Unexpected call for old-range branch: ${path}`);
    });

    // statementCommand always calls process.exit() in its catch block
    // (both via handleJsonError and directly), so stub it out for the
    // duration of this test to keep the assertion path alive.
    const originalExit = process.exit;
    process.exit = (() => undefined) as any;
    try {
      await statementCommand({ month: oldMonth, json: true });
    } finally {
      process.exit = originalExit;
    }

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.message).toContain("Data older than 90 days requires a cached sync");
  });
});
