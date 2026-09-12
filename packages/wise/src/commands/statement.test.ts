import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockWiseGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockWiseGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object using reported balances", async () => {
    const balances = [
      { id: 42, currency: "GBP", type: "STANDARD", amount: { value: 1500, currency: "GBP" } },
    ];
    const statement = {
      startOfStatementBalance: { amount: { value: 1234.56, currency: "GBP" } },
      endOfStatementBalance: { amount: { value: 1500, currency: "GBP" } },
      transactions: [
        { date: "2026-08-05T10:00:00Z", amount: { value: -3.5, currency: "GBP" }, details: { description: "Coffee shop" } },
      ],
    };
    mockWiseGet.mockResolvedValueOnce(balances).mockResolvedValueOnce(statement);

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("wise");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.balance).toEqual({ opening: 1234.56, closing: 1500, type: "cash", source: "reported" });
    expect(parsed.transactionCount).toBe(1);

    expect(mockWiseGet.mock.calls[0][0]).toContain("/balances?types=STANDARD");

    const statementUrl = mockWiseGet.mock.calls[1][0];
    expect(statementUrl).toContain("/balance-statements/42/statement.json");
    expect(statementUrl).toContain("intervalStart=2026-08-01T00%3A00%3A00.000Z");
    expect(statementUrl).toContain("intervalEnd=2026-08-31T23%3A59%3A59.999Z");
    expect(statementUrl).toContain("currency=GBP");
  });

  it("clamps the interval end to today for the current month", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().slice(0, 10);

    const balances = [
      { id: 42, currency: "GBP", type: "STANDARD", amount: { value: 1500, currency: "GBP" } },
    ];
    const statement = { transactions: [] };
    mockWiseGet.mockResolvedValueOnce(balances).mockResolvedValueOnce(statement);

    await statementCommand({ month: currentMonth, json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.period.end).toBe(todayStr);

    const statementUrl = mockWiseGet.mock.calls[1][0];
    expect(statementUrl).toContain(`intervalEnd=${todayStr}T23%3A59%3A59.999Z`);
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
