import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPublicGet, captureStdout } from "./__test-helpers.js";

registerMocks();

const { tickerCommand, normalizePair } = await import("./ticker.js");

const MOCK_TICKER = {
  XBTUSD: {
    c: ["85000.00", "1"],
    b: ["84999.00", "1", "1.000"],
    a: ["85001.00", "1", "1.000"],
    h: ["84000.00", "86000.00"],
    l: ["84000.00", "83000.00"],
    v: ["500.000", "1234.567"],
  },
};

describe("normalizePair", () => {
  it("maps BTC to XBTUSD with default quote", () => {
    expect(normalizePair("BTC", "USD")).toBe("XBTUSD");
  });

  it("maps ETH with EUR quote to ETHEUR", () => {
    expect(normalizePair("ETH", "EUR")).toBe("ETHEUR");
  });

  it("strips slash and maps BTC/USD to XBTUSD", () => {
    expect(normalizePair("BTC/USD", "USD")).toBe("XBTUSD");
  });

  it("passes XBTUSD as-is (already has quote suffix)", () => {
    expect(normalizePair("XBTUSD", "USD")).toBe("XBTUSD");
  });

  it("maps DOGE to XDG prefix", () => {
    expect(normalizePair("DOGE", "USD")).toBe("XDGUSD");
  });
});

describe("tickerCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPublicGet.mockReset();
  });

  afterEach(() => stdout.restore());

  it("displays ticker table for BTC (resolves to XBTUSD)", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce(MOCK_TICKER);

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await tickerCommand("BTC", {});

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("XBTUSD");
    expect(output).toContain("85000.00");
    expect(output).toContain("84999.00");
    expect(output).toContain("85001.00");
    expect(output).toContain("1234.567");
  });

  it("calls API with correct pair for ETH --quote EUR", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce({
      ETHEUR: {
        c: ["3000.00", "1"],
        b: ["2999.00", "1", "1.000"],
        a: ["3001.00", "1", "1.000"],
        h: ["2800.00", "3100.00"],
        l: ["2800.00", "2900.00"],
        v: ["1000.000", "5000.000"],
      },
    });

    await tickerCommand("ETH", { quote: "EUR" });

    expect(mockKrakenPublicGet).toHaveBeenCalledWith("/0/public/Ticker", { pair: "ETHEUR" });
  });

  it("strips slash and maps BTC/USD to XBTUSD before API call", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce(MOCK_TICKER);

    await tickerCommand("BTC/USD", {});

    expect(mockKrakenPublicGet).toHaveBeenCalledWith("/0/public/Ticker", { pair: "XBTUSD" });
  });

  it("passes XBTUSD as-is to API", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce(MOCK_TICKER);

    await tickerCommand("XBTUSD", {});

    expect(mockKrakenPublicGet).toHaveBeenCalledWith("/0/public/Ticker", { pair: "XBTUSD" });
  });

  it("outputs raw JSON with --json flag", async () => {
    mockKrakenPublicGet.mockResolvedValueOnce(MOCK_TICKER);

    await tickerCommand("BTC", { json: true });

    const output = JSON.parse(stdout.getOutput());
    expect(output).toHaveProperty("XBTUSD");
    expect(output.XBTUSD.c[0]).toBe("85000.00");
  });

  it("prints error on unknown pair", async () => {
    mockKrakenPublicGet.mockRejectedValueOnce(new Error("EQuery:Unknown asset pair"));

    const errors: string[] = [];
    const origErr = console.error;
    console.error = (...args: any[]) => { errors.push(args.join(" ")); };

    const origExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code: number) => { exitCode = code; throw new Error("process.exit"); }) as any;

    try {
      await tickerCommand("INVALIDPAIR", {});
    } catch {
      // process.exit throws in test
    }

    console.error = origErr;
    process.exit = origExit;

    expect(errors.join("")).toContain("EQuery:Unknown asset pair");
    expect(exitCode).toBe(1);
  });
});
