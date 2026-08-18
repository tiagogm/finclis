import { krakenPublicGet } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import { printTable } from "../display.js";

const COMMON_TO_ALTNAME: Record<string, string> = {
  BTC: "XBT",
  DOGE: "XDG",
};

const QUOTE_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF"];

export function normalizePair(asset: string, quote: string): string {
  const stripped = asset.replace("/", "").toUpperCase();
  // Already a full pair — apply altname mapping to the base component too
  for (const q of QUOTE_CURRENCIES) {
    if (stripped.endsWith(q)) {
      const base = stripped.slice(0, stripped.length - q.length);
      return `${COMMON_TO_ALTNAME[base] ?? base}${q}`;
    }
  }
  const altname = COMMON_TO_ALTNAME[stripped] ?? stripped;
  return `${altname}${quote.toUpperCase()}`;
}

interface TickerOpts extends BaseCommandOpts {
  quote?: string;
}

export async function tickerCommand(asset: string, opts: TickerOpts = {}): Promise<void> {
  const quote = (opts.quote ?? "USD").toUpperCase();
  const pair = normalizePair(asset, quote);

  try {
    const result = await krakenPublicGet("/0/public/Ticker", { pair });

    if (opts.json) {
      writeJson(result);
      return;
    }

    const entries = Object.entries(result as Record<string, any>);
    if (entries.length === 0) {
      console.error(`No data found for pair: ${pair}`);
      process.exit(1);
    }

    const headers = ["Pair", "Last", "Bid", "Ask", "High", "Low", "Vol (24h)"];
    const rows = entries.map(([pairName, data]) => [
      pairName,
      data.c[0],
      data.b[0],
      data.a[0],
      data.h[1],
      data.l[1],
      data.v[1],
    ]);
    printTable(headers, rows);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
