import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, captureStdout } from "./__test-helpers.js";
import { monthBounds } from "../validate.js";

registerMocks();

const { fundingCommand } = await import("./funding.js");

const DEPOSIT_ENTRY = {
  refid: "REFID1",
  time: 1700000000,
  type: "deposit",
  asset: "ZUSD",
  amount: "1000.0000",
  fee: "0.0000",
  balance: "1000.0000",
};

function captureLog(): { logs: string[]; restore: () => string } {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...args: any[]) => { logs.push(args.join(" ")); };
  return {
    logs,
    restore: () => { console.log = orig; return logs.join("\n"); },
  };
}

describe("fundingCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("prints deposit and withdrawal entries as aligned table (no tabs)", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ledger: {
        "LABCD-11111-AAAAA": DEPOSIT_ENTRY,
        "LABCD-22222-BBBBB": {
          refid: "REFID2",
          time: 1700100000,
          type: "trade",  // filtered out
          asset: "XXBT",
          amount: "0.01000000",
          fee: "0.0000",
          balance: "0.01000000",
        },
      },
      count: 2,
    });

    const cap = captureLog();
    await fundingCommand({});
    const output = cap.restore();

    expect(output).toContain("deposit");
    expect(output).toContain("ZUSD");
    expect(output).toContain("1000.0000");
    expect(output).not.toContain("trade");
    expect(output).not.toContain("\t");
    expect(output).toContain("Date");
    expect(output).toContain("Type");
    expect(output).toContain("Asset");
    expect(output).toContain("Amount");
    expect(output).toContain("Fee");
    expect(output).toContain("ID");
    expect(output).toContain("Showing 1 entry.");
  });

  it("passes --type to the API call", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ledger: {}, count: 0 });

    const cap = captureLog();
    await fundingCommand({ type: "withdrawal" } as any);
    cap.restore();

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith(
      "/0/private/Ledgers",
      expect.objectContaining({ type: "withdrawal" })
    );
  });

  it("passes --asset to the API call", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ledger: {}, count: 0 });

    const cap = captureLog();
    await fundingCommand({ asset: "XXBT" } as any);
    cap.restore();

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith(
      "/0/private/Ledgers",
      expect.objectContaining({ asset: "XXBT" })
    );
  });

  it("outputs json when --json flag set", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ledger: {
        "LABCD-11111-AAAAA": {
          time: 1700000000,
          type: "deposit",
          asset: "ZUSD",
          amount: "500.0000",
          fee: "0",
          balance: "500.0000",
        },
      },
      count: 1,
    });

    await fundingCommand({ json: true });

    const output = JSON.parse(stdout.getOutput());
    expect(output).toHaveProperty("LABCD-11111-AAAAA");
  });

  it("passes --month 2026-02 as correct start/end timestamps to API", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ledger: {}, count: 0 });

    const cap = captureLog();
    await fundingCommand({ month: "2026-02" } as any);
    cap.restore();

    const { start, end } = monthBounds(2, 2026);
    expect(mockKrakenPrivatePost).toHaveBeenCalledWith(
      "/0/private/Ledgers",
      expect.objectContaining({
        start: String(start),
        end: String(end),
      })
    );
  });

  it("shows month label when --month is set", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ledger: {}, count: 0 });

    const cap = captureLog();
    await fundingCommand({ month: "2026-02" } as any);
    const output = cap.restore();

    expect(output).toContain("February 2026");
  });

  it("non-TTY: outputs table without interactive prompt", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ledger: { "LABCD-11111-AAAAA": DEPOSIT_ENTRY },
      count: 1,
    });

    const cap = captureLog();
    await fundingCommand({});
    const output = cap.restore();

    expect(output).toContain("deposit");
    expect(output).not.toContain("[n]ext page");
  });
});
