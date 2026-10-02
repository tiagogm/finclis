import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mockKrakenPrivatePost, registerMocks, captureStdout } from "./__test-helpers.js";

registerMocks();

const { statementCommand } = await import("./statement.js");

describe("statement --json", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("outputs a Statement object for the default fiat asset", async () => {
    mockKrakenPrivatePost.mockImplementation(async (path: string, params: Record<string, string> = {}) => {
      if (path === "/0/private/Balance") {
        return { ZUSD: "2000.0000", XXBT: "0" };
      }
      if (path === "/0/private/Ledgers") {
        if (params.ofs === "0" && params.start === "1754006400") {
          return {
            ledger: {
              L1: { time: 1754006500, type: "deposit", asset: "ZUSD", amount: "500.0000", fee: "0", balance: "2000.0000", refid: "REF1" },
            },
            count: 1,
          };
        }
        return { ledger: {}, count: 0 };
      }
      throw new Error(`Unexpected call: ${path}`);
    });

    await statementCommand({ month: "2025-08", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.platform).toBe("kraken");
    expect(parsed.account.id).toBe("ZUSD");
    expect(parsed.period.month).toBe("2025-08");
    expect(parsed.transactionCount).toBe(1);
  });

  it("uses --asset when explicitly given", async () => {
    mockKrakenPrivatePost.mockImplementation(async (path: string) => {
      if (path === "/0/private/Balance") return { ZUSD: "2000.0000", XXBT: "0.5000" };
      if (path === "/0/private/Ledgers") return { ledger: {}, count: 0 };
      throw new Error(`Unexpected call: ${path}`);
    });

    await statementCommand({ month: "2025-08", asset: "XXBT", json: true });

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.account.id).toBe("XXBT");
  });

  it("errors clearly when no asset is given and no fiat balance exists", async () => {
    mockKrakenPrivatePost.mockImplementation(async (path: string) => {
      if (path === "/0/private/Balance") return { XXBT: "0.5000" };
      throw new Error(`Unexpected call: ${path}`);
    });

    const originalExit = process.exit;
    process.exit = (() => undefined) as any;
    try {
      await statementCommand({ month: "2025-08", json: true });
    } finally {
      process.exit = originalExit;
    }

    const parsed = JSON.parse(stdout.getOutput());
    expect(parsed.message).toContain("--asset");
  });
});
