/**
 * Fetch prices for standard asset symbols in a quote currency.
 * Input:  ["BTC", "DOGE", "GBP", "LRC"]  +  quoteCurrency = "USD"
 * Output: { BTC: 66000, DOGE: 0.15, GBP: 1.26 }  (unknown symbols omitted)
 *
 * Provider: CoinGecko free API — swap implementation here without touching callers.
 */

const COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", DOGE: "dogecoin", LTC: "litecoin",
  XLM: "stellar", XMR: "monero", XRP: "ripple", ZEC: "zcash",
  ETC: "ethereum-classic", LRC: "loopring", DOT: "polkadot",
  ADA: "cardano", SOL: "solana", AVAX: "avalanche-2", MATIC: "matic-network",
  LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos", ALGO: "algorand",
  // extend as needed — this is the only place CoinGecko IDs live
};

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchRates(
  symbols: string[],
  quoteCurrency: string
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const quote = quoteCurrency.toLowerCase();

  const cryptoSymbols = symbols.filter(s => s in COINGECKO_ID);
  const fiatSymbols = symbols.filter(s => !(s in COINGECKO_ID));

  // Crypto via /simple/price
  if (cryptoSymbols.length > 0) {
    try {
      const ids = cryptoSymbols.map(s => COINGECKO_ID[s]).join(",");
      const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=${quote}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as Record<string, Record<string, number>>;
        for (const sym of cryptoSymbols) {
          const id = COINGECKO_ID[sym];
          if (data[id]?.[quote] !== undefined) {
            result[sym] = data[id][quote];
          }
        }
      }
    } catch { /* network error */ }
  }

  // Fiat via /exchange_rates (BTC-relative cross rates)
  if (fiatSymbols.length > 0) {
    try {
      const url = `${COINGECKO_BASE}/exchange_rates`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { rates: Record<string, { value: number }> };
        const rates = data.rates;
        const quoteRate = rates[quote]?.value;
        if (quoteRate !== undefined) {
          for (const sym of fiatSymbols) {
            const symLower = sym.toLowerCase();
            const symRate = rates[symLower]?.value;
            if (symRate !== undefined) {
              // Derive cross rate: sym_in_quote = btc_quote_value / btc_sym_value
              result[sym] = quoteRate / symRate;
            }
          }
        }
      }
    } catch { /* network error */ }
  }

  return result;
}
