import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockT212Get, mockFetchCSV, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

const SAMPLE_CSV = [
  "Action,Time,Total",
  "Deposit,2026-08-05 10:00:00,500.00",
  "Withdrawal,2026-08-10 10:00:00,-50.00",
].join("\n");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockT212Get.mockReset();
    mockFetchCSV.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for a past month", async () => {
    mockFetchCSV.mockResolvedValue(SAMPLE_CSV);
    mockT212Get.mockImplementation(async (path: string) => {
      if (path === "/equity/account/cash") return { free: 1000, invested: 0, total: 1000, ppl: 0 };
      if (path === "/equity/account/info") return { currencyCode: "GBP" };
      throw new Error(`Unexpected path: ${path}`);
    });

    await statementCommand({ month: "2026-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("trading212");
    expect(parsed.period.month).toBe("2026-08");
    expect(parsed.transactionCount).toBe(2);
    expect(parsed.credits).toBe(500);
    expect(parsed.debits).toBe(50);
  });
});
