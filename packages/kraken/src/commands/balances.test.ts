import { describe, it, expect, spyOn } from "bun:test";

describe("balancesCommand", () => {
  it("prints non-zero balances as a table", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({
      ZUSD: "1000.5000",
      XXBT: "0.50000000",
      XETH: "0.0000",
    });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { balancesCommand } = await import("./balances.js");
    await balancesCommand({});

    const output = logs.join("\n");
    expect(output).toContain("ZUSD");
    expect(output).toContain("1000.5000");
    expect(output).toContain("XXBT");
    expect(output).not.toContain("XETH");
  });

  it("outputs json when --json flag set", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ ZUSD: "500.0000" });

    const writes: string[] = [];
    spyOn(process.stdout, "write").mockImplementation((data: any) => { writes.push(String(data)); return true; });

    const { balancesCommand } = await import("./balances.js");
    await balancesCommand({ json: true });

    const output = JSON.parse(writes[0]);
    expect(output).toHaveProperty("ZUSD");
  });

  it("prints message when no non-zero balances", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ ZUSD: "0.0000" });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { balancesCommand } = await import("./balances.js");
    await balancesCommand({});

    expect(logs.join("")).toContain("No balances");
  });
});
