import { describe, it, expect, spyOn } from "bun:test";

describe("fundingCommand", () => {
  it("prints deposit and withdrawal entries by default", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      ledger: {
        "LABCD-11111-AAAAA": {
          refid: "REFID1",
          time: 1700000000,
          type: "deposit",
          asset: "ZUSD",
          amount: "1000.0000",
          fee: "0.0000",
          balance: "1000.0000",
        },
        "LABCD-22222-BBBBB": {
          refid: "REFID2",
          time: 1700100000,
          type: "trade",  // should be filtered out
          asset: "XXBT",
          amount: "0.01000000",
          fee: "0.0000",
          balance: "0.01000000",
        },
      },
      count: 2,
    });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { fundingCommand } = await import("./funding.js");
    await fundingCommand({});

    const output = logs.join("\n");
    expect(output).toContain("deposit");
    expect(output).toContain("ZUSD");
    expect(output).toContain("1000.0000");
    expect(output).not.toContain("trade");
  });

  it("passes --type to the API call", async () => {
    const client = await import("../client.js");
    const spy = spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ ledger: {}, count: 0 });

    spyOn(console, "log").mockImplementation(() => {});

    const { fundingCommand } = await import("./funding.js");
    await fundingCommand({ type: "withdrawal" } as any);

    expect(spy).toHaveBeenCalledWith("/0/private/Ledgers", expect.objectContaining({ type: "withdrawal" }));
  });

  it("outputs json when --json flag set", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      ledger: {
        "LABCD-11111-AAAAA": { time: 1700000000, type: "deposit", asset: "ZUSD", amount: "500.0000", fee: "0", balance: "500.0000" },
      },
      count: 1,
    });

    const writes: string[] = [];
    spyOn(process.stdout, "write").mockImplementation((data: any) => { writes.push(String(data)); return true; });

    const { fundingCommand } = await import("./funding.js");
    await fundingCommand({ json: true });

    const output = JSON.parse(writes[0]);
    expect(output).toHaveProperty("LABCD-11111-AAAAA");
  });
});
