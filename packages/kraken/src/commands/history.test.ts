import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, captureStdout } from "./__test-helpers.js";
import { monthBounds } from "../validate.js";

registerMocks();

const { historyCommand } = await import("./history.js");

const MOCK_ORDER = {
  descr: { pair: "XBTUSD", type: "buy", ordertype: "market" },
  vol_exec: "0.05000000",
  price: "48000.00",
  cost: "2400.00",
  status: "closed",
  closetm: 1700100000,
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

describe("historyCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("prints closed orders as aligned table (no tabs)", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      closed: { "OABCD-11111-AAAAA": MOCK_ORDER },
      count: 1,
    });

    const cap = captureLog();
    await historyCommand({});
    const output = cap.restore();

    expect(output).toContain("XBTUSD");
    expect(output).toContain("48000.00");
    expect(output).toContain("buy");
    expect(output).toContain("Date");
    expect(output).toContain("Pair");
    expect(output).toContain("ID");
    expect(output).not.toContain("\t");
    expect(output).toContain("OABCD-11111-AAAAA");
  });

  it("passes --pair to the API call", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ closed: {}, count: 0 });

    const cap = captureLog();
    await historyCommand({ pair: "XBTUSD" });
    cap.restore();

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith(
      "/0/private/ClosedOrders",
      expect.objectContaining({ pair: "XBTUSD" })
    );
  });

  it("passes --offset to the API as ofs", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ closed: {}, count: 0 });

    const cap = captureLog();
    await historyCommand({ offset: "50" } as any);
    cap.restore();

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith(
      "/0/private/ClosedOrders",
      expect.objectContaining({ ofs: "50" })
    );
  });

  it("outputs json when --json flag set", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      closed: { "OABCD-11111-AAAAA": { descr: { pair: "XBTUSD" }, closetm: 1700100000 } },
      count: 1,
    });

    await historyCommand({ json: true });

    const output = JSON.parse(stdout.getOutput());
    expect(output).toHaveProperty("OABCD-11111-AAAAA");
  });

  it("passes --month 2026-01 as correct start/end timestamps to API", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ closed: {}, count: 0 });

    const cap = captureLog();
    await historyCommand({ month: "2026-01" } as any);
    cap.restore();

    const { start, end } = monthBounds(1, 2026);
    expect(mockKrakenPrivatePost).toHaveBeenCalledWith(
      "/0/private/ClosedOrders",
      expect.objectContaining({
        start: String(start),
        end: String(end),
      })
    );
  });

  it("shows month label when --month is set", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ closed: {}, count: 0 });

    const cap = captureLog();
    await historyCommand({ month: "2026-01" } as any);
    const output = cap.restore();

    expect(output).toContain("January 2026");
  });

  it("non-TTY: outputs table without interactive prompt", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      closed: { "OABCD-11111-AAAAA": MOCK_ORDER },
      count: 1,
    });

    const cap = captureLog();
    await historyCommand({});
    const output = cap.restore();

    expect(output).toContain("XBTUSD");
    expect(output).not.toContain("[n]ext page");
  });
});
