import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { fetchRates } from "./rates.js";

describe("fetchRates", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("fetches crypto prices from CoinGecko /simple/price", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dogecoin: { usd: 0.15 },
        bitcoin: { usd: 66000 },
      }),
    } as any);

    const result = await fetchRates(["DOGE", "BTC"], "USD");

    expect(result).toEqual({ DOGE: 0.15, BTC: 66000 });

    const url = (fetchSpy.mock.calls[0] as [string])[0];
    expect(url).toContain("/simple/price");
    expect(url).toContain("ids=dogecoin,bitcoin");
    expect(url).toContain("vs_currencies=usd");
  });

  it("fetches fiat rates from CoinGecko /exchange_rates and derives cross rate", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rates: {
          usd: { value: 60000 },  // 1 BTC = 60000 USD
          gbp: { value: 47000 },  // 1 BTC = 47000 GBP
        },
      }),
    } as any);

    const result = await fetchRates(["GBP"], "USD");

    // GBP/USD = 60000 / 47000 ≈ 1.2766
    expect(result.GBP).toBeCloseTo(60000 / 47000, 5);

    const url = (fetchSpy.mock.calls[0] as [string])[0];
    expect(url).toContain("/exchange_rates");
  });

  it("handles mixed crypto + fiat in one call", async () => {
    // First call: crypto /simple/price
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ dogecoin: { usd: 0.15 } }),
    } as any);
    // Second call: fiat /exchange_rates
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rates: {
          usd: { value: 60000 },
          gbp: { value: 47000 },
        },
      }),
    } as any);

    const result = await fetchRates(["DOGE", "GBP"], "USD");

    expect(result.DOGE).toBe(0.15);
    expect(result.GBP).toBeCloseTo(60000 / 47000, 5);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns {} on network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchRates(["BTC", "GBP"], "USD");

    expect(result).toEqual({});
  });

  it("omits unknown symbols", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 66000 } }),
    } as any);

    // "UNKNOWN" is not in COINGECKO_ID, so treated as fiat
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { usd: { value: 60000 } } }), // no "unknown" key
    } as any);

    const result = await fetchRates(["BTC", "UNKNOWN"], "USD");

    expect(result).toHaveProperty("BTC", 66000);
    expect(result).not.toHaveProperty("UNKNOWN");
  });
});
