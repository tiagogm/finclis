import { describe, it, expect, spyOn } from "bun:test";

describe("ordersCommand", () => {
  it("prints open orders as a table", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
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
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { ordersCommand } = await import("./orders.js");
    await ordersCommand({});

    const output = logs.join("\n");
    expect(output).toContain("XBTUSD");
    expect(output).toContain("buy");
    expect(output).toContain("50000.00");
  });

  it("prints message when no open orders", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ open: {} });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { ordersCommand } = await import("./orders.js");
    await ordersCommand({});

    expect(logs.join("")).toContain("No open orders");
  });

  it("outputs json when --json flag set", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      open: { "OABCD-12345-ABCDE": { descr: { pair: "XBTUSD" } } },
    });

    const writes: string[] = [];
    spyOn(process.stdout, "write").mockImplementation((data: any) => { writes.push(String(data)); return true; });

    const { ordersCommand } = await import("./orders.js");
    await ordersCommand({ json: true });

    const output = JSON.parse(writes[0]);
    expect(output).toHaveProperty("OABCD-12345-ABCDE");
  });
});
