import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockVanguardGet, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockVanguardGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a past month", async () => {
    mockVanguardGet.mockImplementation(async (url: string) => {
      if (url.includes("InvestmentMonthlyPerformance")) {
        return [
          {
            Month: "Aug 2026",
            PerformanceDetail: {
              OpeningValue: { Amount: 10000 },
              ClosingValue: { Amount: 10500 },
              PaymentsIn: { Amount: 300 },
              PaymentsOut: { Amount: 50 },
            },
          },
        ];
      }
      if (url.includes("CashBalance")) {
        return { Amount: 250 };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("vanguard");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.balance).toEqual({ opening: 10000, closing: 10500, type: "portfolio", source: "reported" });
    expect(parsed.cashBalance.amount).toBe(250);
  });
});
