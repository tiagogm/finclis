import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { registerMocks, mockKrakenPrivatePost, mockKrakenPublicGet, mockFetchRates, captureStdout } from "./__test-helpers.js";

registerMocks();

const { balancesCommand } = await import("./balances.js");

const MOCK_ASSETS = {
  ZUSD: { altname: "USD", decimals: 4, display_decimals: 2 },
  XXBT: { altname: "XBT", decimals: 10, display_decimals: 5 }, // Kraken altname is XBT (not BTC)
  XETH: { altname: "ETH", decimals: 10, display_decimals: 5 },
};

const MOCK_TICKER_USD = {
  XXBTZUSD: { c: ["50000.00", "0.001"] },
  XETHZUSD: { c: ["3000.00", "0.1"] },
};

describe("balancesCommand", () => {
  const stdout = captureStdout();

  beforeEach(() => {
    stdout.reset();
    mockKrakenPrivatePost.mockReset();
    mockKrakenPublicGet.mockReset();
    mockFetchRates.mockReset();
    mockFetchRates.mockResolvedValue({});
  });

  afterEach(() => stdout.restore());

  it("prints balances without Est. column when no --rates flag", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ZUSD: "1000.5000",
      XXBT: "0.50000000",
      XETH: "0.0000",
    });
    mockKrakenPublicGet.mockResolvedValueOnce(MOCK_ASSETS); // Assets only, no Ticker

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({});

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("ZUSD");
    expect(output).toContain("USD");        // Name column
    expect(output).toContain("1000.5000");
    expect(output).toContain("XXBT");
    expect(output).toContain("BTC");        // Name column
    expect(output).not.toContain("In ");    // No currency column without --rates
    expect(output).not.toContain("XETH");
    // Ticker should NOT have been called
    expect(mockKrakenPublicGet).toHaveBeenCalledTimes(1);
  });

  it("outputs json without est_value when no --rates flag", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ZUSD: "500.0000" });
    mockKrakenPublicGet.mockResolvedValueOnce(MOCK_ASSETS); // Assets only, no crypto

    await balancesCommand({ json: true });

    const output = JSON.parse(stdout.getOutput());
    expect(output).toHaveProperty("ZUSD");
    expect(output.ZUSD).toHaveProperty("altname", "USD");
    expect(output.ZUSD).not.toHaveProperty("est_value");
    expect(output).not.toHaveProperty("rates");
  });

  it("prints message when no non-zero balances", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ZUSD: "0.0000" });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({});

    console.log = origLog;

    expect(logs.join("")).toContain("No balances");
  });

  it("--rates USD shows 'In USD' and Price columns and fetches ticker", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ZUSD: "1000.5000",
      XXBT: "0.50000000",
      XETH: "0.0000",
    });
    mockKrakenPublicGet
      .mockResolvedValueOnce(MOCK_ASSETS)
      .mockResolvedValueOnce(MOCK_TICKER_USD);

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "USD" });

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("In USD");
    expect(output).toContain("Price");
    expect(output).toContain("50000.00");  // Price of BTC
    expect(output).toContain("25000.00");  // 0.5 BTC * 50000
    expect(output).toContain("1000.50");   // ZUSD shown directly
    expect(mockKrakenPublicGet).toHaveBeenCalledTimes(2);

    // Ticker called with altname-based pair: XBT (not BTC)
    const tickerCall = mockKrakenPublicGet.mock.calls[1];
    expect(tickerCall[1].pair).toContain("XBTUSD");
  });

  it("DOGE uses DOGEUSD pair (not XDGUSD) because XDG altname is overridden", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ XXDG: "1000.00000000" });
    mockKrakenPublicGet
      .mockResolvedValueOnce({ XXDG: { altname: "XDG", decimals: 10, display_decimals: 2 } })
      .mockResolvedValueOnce({ DOGEUSD: { c: ["0.15", "1"] } });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "USD" });

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("150.00");   // 1000 * 0.15
    expect(output).toContain("0.15");     // Price column (from Kraken, no †)
    expect(output).not.toContain("†");    // No external source marker

    const tickerCall = mockKrakenPublicGet.mock.calls[1];
    expect(tickerCall[1].pair).toContain("DOGEUSD");
  });

  it("DOGE falls back to CoinGecko when Kraken ticker fails", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ XXDG: "1000.00000000" });
    mockKrakenPublicGet
      .mockResolvedValueOnce({ XXDG: { altname: "XDG", decimals: 10, display_decimals: 2 } })
      .mockRejectedValueOnce(new Error("EQuery:Unknown asset pair"));
    mockFetchRates.mockResolvedValueOnce({ DOGE: 0.15 });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "USD" });

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("0.15†");    // Price from CoinGecko
    expect(output).toContain("150.00†");  // Est value from CoinGecko
    expect(output).toContain("CoinGecko"); // Footnote printed
    expect(mockFetchRates).toHaveBeenCalledWith(["DOGE"], "USD");
  });

  it("--rates GBP shows 'In GBP' column and ZGBP balance directly", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ZGBP: "800.0000",
      XXBT: "0.25000000",
    });
    mockKrakenPublicGet
      .mockResolvedValueOnce({
        ZGBP: { altname: "GBP", decimals: 4, display_decimals: 2 },
        XXBT: { altname: "XBT", decimals: 10, display_decimals: 5 },
      })
      .mockResolvedValueOnce({ XXBTZGBP: { c: ["40000.00", "0.001"] } });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "GBP" });

    console.log = origLog;

    const output = logs.join("\n");
    expect(output).toContain("In GBP");
    expect(output).toContain("800.0000");  // ZGBP balance shown directly (raw Kraken precision)
    expect(output).toContain("10000.00");  // 0.25 BTC * 40000
    expect(output).toContain("40000.00");  // Price of BTC in GBP
  });

  it("non-native fiat (ZGBP) shows exchange rate when --rates USD via CoinGecko fallback", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ZGBP: "800.0000" });
    mockKrakenPublicGet
      .mockResolvedValueOnce({ ZGBP: { altname: "GBP", decimals: 4, display_decimals: 2 } })
      .mockResolvedValueOnce({});  // Kraken returns nothing for GBPUSD
    mockFetchRates.mockResolvedValueOnce({ GBP: 1.26 });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "USD" });

    console.log = origLog;

    const output = logs.join("\n");
    const gbpLine = output.split("\n").find(l => l.startsWith("ZGBP"));
    expect(gbpLine).toContain("1.26†");    // Price column: GBP/USD rate
    expect(gbpLine).toContain("1008.00†"); // In USD: 800 * 1.26
    expect(output).toContain("CoinGecko");
    expect(mockFetchRates).toHaveBeenCalledWith(["GBP"], "USD");
  });

  it("native fiat (ZUSD + --rates USD) shows '—' in Price column", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({ ZUSD: "500.0000" });
    mockKrakenPublicGet
      .mockResolvedValueOnce({ ZUSD: { altname: "USD", decimals: 4, display_decimals: 2 } })

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "USD" });

    console.log = origLog;

    const output = logs.join("\n");
    const usdLine = output.split("\n").find(l => l.startsWith("ZUSD"));
    expect(usdLine).toContain("—");    // Price = "—"
    expect(usdLine).toContain("500.0000"); // In USD = raw balance string (Kraken precision)
    // Ticker should NOT be called (no assetsToPrice)
    expect(mockKrakenPublicGet).toHaveBeenCalledTimes(1);
  });

  it("non-native fiat shows — when Kraken and CoinGecko both have no rate", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ZUSD: "500.0000",
      ZGBP: "800.0000",
    });
    mockKrakenPublicGet
      .mockResolvedValueOnce({
        ZUSD: { altname: "USD", decimals: 4, display_decimals: 2 },
        ZGBP: { altname: "GBP", decimals: 4, display_decimals: 2 },
      })
      .mockResolvedValueOnce({});
    mockFetchRates.mockResolvedValueOnce({});

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { logs.push(args.join(" ")); };

    await balancesCommand({ rates: "GBP" });

    console.log = origLog;

    const output = logs.join("\n");
    const zusdLine = output.split("\n").find(l => l.startsWith("ZUSD"));
    expect(zusdLine).toContain("—");
    const zgbpLine = output.split("\n").find(l => l.startsWith("ZGBP"));
    expect(zgbpLine).toContain("800.0000");
  });

  it("JSON with --rates has rates, price, and est_value fields", async () => {
    mockKrakenPrivatePost.mockResolvedValueOnce({
      ZGBP: "800.0000",
      XXBT: "0.25000000",
    });
    mockKrakenPublicGet
      .mockResolvedValueOnce({
        ZGBP: { altname: "GBP", decimals: 4, display_decimals: 2 },
        XXBT: { altname: "XBT", decimals: 10, display_decimals: 5 },
      })
      .mockResolvedValueOnce({ XXBTZGBP: { c: ["40000.00", "0.001"] } });

    await balancesCommand({ json: true, rates: "GBP" });

    const output = JSON.parse(stdout.getOutput());
    expect(output.rates).toBe("GBP");
    expect(output.ZGBP).toHaveProperty("est_value", 800);
    expect(output.ZGBP).toHaveProperty("altname", "GBP");
    expect(output.XXBT).toHaveProperty("price", 40000);
    expect(output.XXBT).toHaveProperty("est_value", 10000);
  });
});
