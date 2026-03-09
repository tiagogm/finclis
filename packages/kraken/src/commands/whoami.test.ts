import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, mockKrakenPublicGet, captureStdout } from "./__test-helpers.js";

registerMocks();

const { whoamiCommand } = await import("./whoami.js");

describe("whoamiCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
    mockKrakenPublicGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("prints status when authenticated", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce({ status: "online", timestamp: "2024-01-01T00:00:00Z" });
    mockKrakenPrivatePost.mockResolvedValueOnce({ ZUSD: "1000.0000" });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await whoamiCommand({});

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("online");
    expect(output).toContain("Authenticated");
  });

  it("outputs json when --json flag set", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce({ status: "online", timestamp: "2024-01-01T00:00:00Z" });
    mockKrakenPrivatePost.mockResolvedValueOnce({ ZUSD: "500.0000" });

    await whoamiCommand({ json: true });

    const raw = stdout.getOutput();
    expect(() => JSON.parse(raw)).not.toThrow();
    const output = JSON.parse(raw);
    expect(output).toHaveProperty("status");
  });
});
