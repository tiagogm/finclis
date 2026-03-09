import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, captureStdout } from "./__test-helpers.js";

registerMocks();

const { orderCommand } = await import("./order.js");

describe("orderCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("places a market buy with all flags and --yes", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      txid: ["OTEST-11111-TTTTT"],
      descr: { order: "buy 0.01 XBTUSD @ market" },
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await orderCommand({
      pair: "XBTUSD",
      side: "buy",
      type: "market",
      amount: "0.01",
      yes: true,
    });

    console.log = origLog;

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith("/0/private/AddOrder", expect.objectContaining({
      pair: "XBTUSD",
      type: "buy",
      ordertype: "market",
      volume: "0.01",
    }));
    expect(logs.join("")).toContain("OTEST-11111-TTTTT");
  });

  it("places a limit sell with price flag", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      txid: ["OTEST-22222-SSSSS"],
      descr: { order: "sell 0.5 XBTUSD @ limit 60000" },
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await orderCommand({
      pair: "XBTUSD",
      side: "sell",
      type: "limit",
      amount: "0.5",
      price: "60000",
      yes: true,
    });

    console.log = origLog;

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith("/0/private/AddOrder", expect.objectContaining({
      pair: "XBTUSD",
      type: "sell",
      ordertype: "limit",
      volume: "0.5",
      price: "60000",
    }));
  });

  it("exits with error for invalid side", async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: any[]) => { errors.push(args.join(" ")); };
    const exitSpy = spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    try {
      await expect(orderCommand({
        pair: "XBTUSD",
        side: "invalid",
        type: "market",
        amount: "0.01",
        yes: true,
      })).rejects.toThrow("exit");
    } finally {
      console.error = origError;
      exitSpy.mockRestore();
    }

    expect(errors.join("")).toContain("buy");
  });

  it("exits with error for limit order missing price when --yes provided", async () => {
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: any[]) => { errors.push(args.join(" ")); };
    const exitSpy = spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    try {
      await expect(orderCommand({
        pair: "XBTUSD",
        side: "buy",
        type: "limit",
        amount: "0.01",
        yes: true,
        // no price
      })).rejects.toThrow("exit");
    } finally {
      console.error = origError;
      exitSpy.mockRestore();
    }

    expect(errors.join("")).toContain("price");
  });
});
