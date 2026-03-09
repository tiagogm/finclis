import { describe, it, expect, spyOn, beforeEach } from "bun:test";

describe("whoamiCommand", () => {
  beforeEach(() => {
    // Reset spies
  });

  it("prints status when authenticated", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPublicGet").mockResolvedValueOnce({ status: "online", timestamp: "2024-01-01T00:00:00Z" });
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ ZUSD: "1000.0000" });

    const logs: string[] = [];
    spyOn(console, "log").mockImplementation((...args: any[]) => { logs.push(args.join(" ")); });

    const { whoamiCommand } = await import("./whoami.js");
    await whoamiCommand({});

    const output = logs.join("\n");
    expect(output).toContain("online");
    expect(output).toContain("Authenticated");
  });

  it("outputs json when --json flag set", async () => {
    const client = await import("../client.js");
    spyOn(client, "krakenPublicGet").mockResolvedValueOnce({ status: "online", timestamp: "2024-01-01T00:00:00Z" });
    spyOn(client, "krakenPrivatePost").mockResolvedValueOnce({ ZUSD: "500.0000" });

    const chunks: string[] = [];
    spyOn(process.stdout, "write").mockImplementation((chunk: any) => { chunks.push(chunk.toString()); return true; });

    const { whoamiCommand } = await import("./whoami.js");
    await whoamiCommand({ json: true });

    const raw = chunks.join("");
    expect(() => JSON.parse(raw)).not.toThrow();
    const output = JSON.parse(raw);
    expect(output).toHaveProperty("status");
  });
});
