import { describe, it, expect, spyOn } from "bun:test";

describe("orderCommand", () => {
  it("places a market buy with all flags and --yes", async () => {
    const client = await import("../client.js");
    const postSpy = spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      txid: ["OTEST-11111-TTTTT"],
      descr: { order: "buy 0.01 XBTUSD @ market" },
    });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { orderCommand } = await import("./order.js");
    await orderCommand({
      pair: "XBTUSD",
      side: "buy",
      type: "market",
      amount: "0.01",
      yes: true,
    });

    expect(postSpy).toHaveBeenCalledWith("/0/private/AddOrder", expect.objectContaining({
      pair: "XBTUSD",
      type: "buy",
      ordertype: "market",
      volume: "0.01",
    }));
    expect(logs.join("")).toContain("OTEST-11111-TTTTT");
  });

  it("places a limit sell with price flag", async () => {
    const client = await import("../client.js");
    const postSpy = spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      txid: ["OTEST-22222-SSSSS"],
      descr: { order: "sell 0.5 XBTUSD @ limit 60000" },
    });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { orderCommand } = await import("./order.js");
    await orderCommand({
      pair: "XBTUSD",
      side: "sell",
      type: "limit",
      amount: "0.5",
      price: "60000",
      yes: true,
    });

    expect(postSpy).toHaveBeenCalledWith("/0/private/AddOrder", expect.objectContaining({
      pair: "XBTUSD",
      type: "sell",
      ordertype: "limit",
      volume: "0.5",
      price: "60000",
    }));
  });

  it("exits with error for invalid side", async () => {
    const errors: string[] = [];
    spyOn(console, "error").mockImplementation((...args: any[]) => { errors.push(args.join(" ")); });
    spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const { orderCommand } = await import("./order.js");
    await expect(orderCommand({
      pair: "XBTUSD",
      side: "invalid",
      type: "market",
      amount: "0.01",
      yes: true,
    })).rejects.toThrow("exit");

    expect(errors.join("")).toContain("buy");
  });

  it("exits with error for limit order missing price when --yes provided", async () => {
    const errors: string[] = [];
    spyOn(console, "error").mockImplementation((...args: any[]) => { errors.push(args.join(" ")); });
    spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    const { orderCommand } = await import("./order.js");
    await expect(orderCommand({
      pair: "XBTUSD",
      side: "buy",
      type: "limit",
      amount: "0.01",
      yes: true,
      // no price
    })).rejects.toThrow("exit");

    expect(errors.join("")).toContain("price");
  });
});
