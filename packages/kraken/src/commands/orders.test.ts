import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, captureStdout } from "./__test-helpers.js";

registerMocks();

const { ordersCommand } = await import("./orders.js");

describe("ordersCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("prints open orders as a table", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      open: {
        "OABCD-12345-ABCDE": {
          descr: { pair: "XBTUSD", type: "buy", ordertype: "limit", price: "50000.00" },
          vol: "0.10000000",
          status: "open",
          opentm: 1700000000,
        },
      },
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await ordersCommand({});

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("XBTUSD");
    expect(output).toContain("buy");
    expect(output).toContain("50000.00");
  });

  it("prints message when no open orders", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ open: {} });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await ordersCommand({});

    console.log = origLog;

    expect(logs.join("")).toContain("No open orders");
  });

  it("outputs json when --json flag set", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      open: { "OABCD-12345-ABCDE": { descr: { pair: "XBTUSD" } } },
    });

    await ordersCommand({ json: true });

    const output = JSON.parse(stdout.getOutput());
    expect(output).toHaveProperty("OABCD-12345-ABCDE");
  });
});
