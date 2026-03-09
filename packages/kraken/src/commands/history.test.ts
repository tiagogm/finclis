import { describe, it, expect, spyOn } from "bun:test";

describe("historyCommand", () => {
  it("prints closed orders as a table", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      closed: {
        "OABCD-11111-AAAAA": {
          descr: { pair: "XBTUSD", type: "buy", ordertype: "market" },
          vol_exec: "0.05000000",
          price: "48000.00",
          cost: "2400.00",
          status: "closed",
          closetm: 1700100000,
        },
      },
      count: 1,
    });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { historyCommand } = await import("./history.js");
    await historyCommand({});

    const output = logs.join("\n");
    expect(output).toContain("XBTUSD");
    expect(output).toContain("48000.00");
    expect(output).toContain("buy");
  });

  it("passes --pair to the API call", async () => {
    const client = await import("../client.js");
    const spy = spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ closed: {}, count: 0 });

    spyOn(console, "log").mockImplementation(() => {});

    const { historyCommand } = await import("./history.js");
    await historyCommand({ pair: "XBTUSD" });

    expect(spy).toHaveBeenCalledWith("/0/private/ClosedOrders", expect.objectContaining({ pair: "XBTUSD" }));
  });

  it("outputs json when --json flag set", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      closed: { "OABCD-11111-AAAAA": { descr: { pair: "XBTUSD" }, closetm: 1700100000 } },
      count: 1,
    });

    const writes: string[] = [];
    spyOn(process.stdout, "write").mockImplementation((data: any) => { writes.push(String(data)); return true; });

    const { historyCommand } = await import("./history.js");
    await historyCommand({ json: true });

    const output = JSON.parse(writes[0]);
    expect(output).toHaveProperty("OABCD-11111-AAAAA");
  });
});
