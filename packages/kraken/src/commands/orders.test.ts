import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, mockPrompt, captureStdout } from "./__test-helpers.js";

registerMocks();

const { ordersCommand, cancelCommand, queryCommand } = await import("./orders.js");

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

  it("prints table with aligned columns (no tabs)", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      open: {
        "OABCD-11111-AAAAA": {
          descr: { pair: "XBTUSD", type: "buy", ordertype: "market", price: "0" },
          vol: "0.001",
          status: "open",
          opentm: 1735776000, // 2026-01-02
        },
      },
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await ordersCommand({});

    console.log = origLog;

    const header = logs[0];
    const dataRow = logs[2];

    // Header should have space-padded columns, not tabs
    expect(header).not.toContain("\t");
    expect(header).toMatch(/Date\s+Pair\s+Side\s+Type\s+Price\s+Volume\s+ID/);

    // Data row should contain the expected values with space padding
    expect(dataRow).toContain("XBTUSD");
    expect(dataRow).toContain("buy");
    expect(dataRow).toContain("market");
    expect(dataRow).toContain("OABCD-11111-AAAAA");
    expect(dataRow).not.toContain("\t");
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

describe("cancelCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
    mockPrompt.mockReset();
  });

  afterEach(() => stdout.restore());

  it("prompts and cancels when user confirms", async () => {
    mockPrompt.mockResolvedValueOnce("y");
    mockKrakenPrivatePost.mockResolvedValueOnce({ count: 1, pending: false });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await cancelCommand("OABCD-11111-AAAAA", {});

    console.log = origLog;

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith("/0/private/CancelOrder", { txid: "OABCD-11111-AAAAA" });
    expect(logs.join("")).toContain("Cancelled 1 order.");
  });

  it("aborts when user declines prompt", async () => {
    mockPrompt.mockResolvedValueOnce("n");

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await cancelCommand("OABCD-11111-AAAAA", {});

    console.log = origLog;

    expect(mockKrakenPrivatePost).not.toHaveBeenCalled();
    expect(logs.join("")).toContain("Aborted");
  });

  it("skips prompt with --yes flag", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ count: 1, pending: false });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await cancelCommand("OABCD-11111-AAAAA", { yes: true });

    console.log = origLog;

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(logs.join("")).toContain("Cancelled 1 order.");
  });
});

describe("cancelCommand --all", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
    mockPrompt.mockReset();
  });

  afterEach(() => stdout.restore());

  it("prompts and cancels all when confirmed", async () => {
    mockPrompt.mockResolvedValueOnce("y");
    mockKrakenPrivatePost.mockResolvedValueOnce({ count: 3 });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await cancelCommand(undefined, { all: true });

    console.log = origLog;

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith("/0/private/CancelAll", {});
    expect(logs.join("")).toContain("Cancelled 3 orders.");
  });

  it("skips prompt with --yes flag", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ count: 2 });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await cancelCommand(undefined, { all: true, yes: true });

    console.log = origLog;

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(logs.join("")).toContain("Cancelled 2 orders.");
  });
});

describe("queryCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
  });

  afterEach(() => stdout.restore());

  it("displays table with status column for queried orders", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      "OABCD-11111-AAAAA": {
        descr: { pair: "XBTUSD", type: "buy", ordertype: "limit", price: "50000.00" },
        vol: "0.10000000",
        status: "closed",
        opentm: 1700000000,
        closetm: 1700010000,
      },
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await queryCommand(["OABCD-11111-AAAAA"], {});

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("Status");
    expect(output).toContain("closed");
    expect(output).toContain("XBTUSD");
    expect(output).toContain("OABCD-11111-AAAAA");
  });

  it("sends multiple txids joined by comma", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      "OABCD-11111-AAAAA": {
        descr: { pair: "XBTUSD", type: "buy", ordertype: "limit", price: "50000.00" },
        vol: "0.10000000",
        status: "open",
        opentm: 1700000000,
        closetm: 0,
      },
    });

    await queryCommand(["OABCD-11111-AAAAA", "OABCD-22222-BBBBB"], {});

    expect(mockKrakenPrivatePost).toHaveBeenCalledWith("/0/private/QueryOrders", {
      txid: "OABCD-11111-AAAAA,OABCD-22222-BBBBB",
    });
  });

  it("outputs json with --json flag", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      "OABCD-11111-AAAAA": { descr: { pair: "XBTUSD" } },
    });

    await queryCommand(["OABCD-11111-AAAAA"], { json: true });

    const output = JSON.parse(stdout.getOutput());
    expect(output).toHaveProperty("OABCD-11111-AAAAA");
  });
});
