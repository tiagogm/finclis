import { krakenPrivatePost, krakenPublicGet } from "../client.js";
import { fetchRates } from "../rates.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import { printTable } from "../display.js";

// Source: CCXT commonCurrencies for Kraken (industry standard mapping for legacy X/Z-prefixed assets)
const ASSET_CODE_TO_NAME: Record<string, string> = {
  XXBT: "BTC", XXDG: "DOGE", XETH: "ETH", XLTC: "LTC", XXLM: "XLM",
  XXMR: "XMR", XXRP: "XRP", XZEC: "ZEC", XETC: "ETC", XMLN: "MLN",
  XREP: "REP", XDG: "DOGE", XBT: "BTC",
  ZUSD: "USD", ZEUR: "EUR", ZGBP: "GBP", ZJPY: "JPY", ZAUD: "AUD", ZCAD: "CAD",
  LUNA: "LUNC", LUNA2: "LUNA", REPV2: "REP", REP: "REPV1", UST: "USTC", FEE: "KFEE",
};

// Overrides for altnames that don't work as Kraken pair prefixes
// e.g. altname "XDG" is not used in pairs — actual pair prefix is "DOGE"
const ALTNAME_PAIR_OVERRIDE: Record<string, string> = {
  XDG: "DOGE",
};

function displayName(assetCode: string, altname: string): string {
  return ASSET_CODE_TO_NAME[assetCode] ?? altname;
}

interface BalancesOpts extends BaseCommandOpts {
  rates?: string;
}

export async function balancesCommand(opts: BalancesOpts = {}): Promise<void> {
  try {
    const balances = await krakenPrivatePost("/0/private/Balance", {});
    const nonZero = Object.entries(balances as Record<string, string>)
      .filter(([, amount]) => parseFloat(amount) !== 0);

    if (nonZero.length === 0) {
      if (opts.json) { writeJson({}); return; }
      console.log("No balances found.");
      return;
    }

    const assetsInfo = await krakenPublicGet("/0/public/Assets");
    const altnameMap: Record<string, string> = {};
    for (const [code, info] of Object.entries(assetsInfo as Record<string, any>)) {
      altnameMap[code] = (info as any).altname;
    }

    const quoteCurrency = opts.rates?.toUpperCase();
    const nativeFiat = quoteCurrency ? `Z${quoteCurrency}` : undefined;

    const priceMap: Record<string, number> = {};
    const externalPriced = new Set<string>();

    if (quoteCurrency) {
      // Include all non-earn, non-native-fiat assets in price lookup
      // Earn variants contain '.'; native fiat (e.g. ZGBP when --rates GBP) is excluded
      const assetsToPrice = nonZero
        .filter(([asset]) => !asset.includes(".") && asset !== nativeFiat)
        .map(([asset]) => asset);

      if (assetsToPrice.length > 0) {
        // For fiat (Z-prefix): strip Z to get currency code (ZGBP → "GBP")
        // For crypto: use Kraken altname + override (XXDG → XDG → DOGE)
        const pairNameForAsset = (asset: string): string => {
          if (asset.startsWith("Z")) return asset.slice(1);  // fiat: ZGBP → "GBP"
          const alt = altnameMap[asset] ?? asset;
          return ALTNAME_PAIR_OVERRIDE[alt] ?? alt;           // crypto: XDG → "DOGE"
        };
        const pairForAsset = (asset: string): string =>
          `${pairNameForAsset(asset)}${quoteCurrency}`;

        // Reverse map: pair prefix → asset code (e.g. "XBT" → "XXBT", "DOGE" → "XXDG", "GBP" → "ZGBP")
        const pairNameToAsset: Record<string, string> = {};
        for (const asset of assetsToPrice) {
          pairNameToAsset[pairNameForAsset(asset)] = asset;
        }

        const legacySuffix = `Z${quoteCurrency}`;  // e.g. "ZUSD", "ZGBP"
        const directSuffix = quoteCurrency;

        const parseTicker = (tickerData: Record<string, any>) => {
          for (const [returnedPair, data] of Object.entries(tickerData)) {
            let stripped: string | undefined;
            // Check legacySuffix first (longer) to avoid false matches
            if (returnedPair.endsWith(legacySuffix)) {
              stripped = returnedPair.slice(0, -legacySuffix.length);
            } else if (returnedPair.endsWith(directSuffix)) {
              stripped = returnedPair.slice(0, -directSuffix.length);
            }
            if (stripped) {
              // Match by raw asset code (e.g. XXBT from XXBTZUSD)
              // or pair prefix (e.g. XBT from XBTGBP, DOGE from DOGEGBP, GBP from GBPUSD)
              const assetCode = assetsToPrice.includes(stripped)
                ? stripped
                : pairNameToAsset[stripped];
              if (assetCode) priceMap[assetCode] = parseFloat((data as any).c[0]);
            }
          }
        };

        // Try batch call first
        const batchPairs = assetsToPrice.map(pairForAsset).join(",");
        try {
          const tickerData = await krakenPublicGet("/0/public/Ticker", { pair: batchPairs });
          parseTicker(tickerData as Record<string, any>);
        } catch {
          // Batch failed (e.g. some pairs don't exist); fall back to individual calls
          await Promise.all(
            assetsToPrice.map(async (asset) => {
              try {
                const td = await krakenPublicGet("/0/public/Ticker", { pair: pairForAsset(asset) });
                parseTicker(td as Record<string, any>);
              } catch { /* no pair for this asset */ }
            })
          );
        }

        // Fallback to CoinGecko for any assets still missing a price
        const missing = assetsToPrice.filter(a => priceMap[a] === undefined);
        if (missing.length > 0) {
          // Map Kraken asset codes to standard symbols for the external provider
          const standardSymbol = (asset: string): string => {
            if (asset.startsWith("Z")) return asset.slice(1);  // ZGBP → "GBP"
            return ASSET_CODE_TO_NAME[asset]                   // XXDG → "DOGE", XXBT → "BTC"
              ?? (ALTNAME_PAIR_OVERRIDE[altnameMap[asset] ?? asset] ?? altnameMap[asset] ?? asset);
          };
          const symToAsset: Record<string, string> = {};
          for (const a of missing) { symToAsset[standardSymbol(a)] = a; }
          const fetched = await fetchRates(Object.keys(symToAsset), quoteCurrency);
          for (const [sym, price] of Object.entries(fetched)) {
            const asset = symToAsset[sym];
            if (asset) {
              priceMap[asset] = price;
              externalPriced.add(asset);
            }
          }
        }
      }
    }

    function getPrice(asset: string): string {
      if (asset === nativeFiat || asset.includes(".")) return "—";
      if (priceMap[asset] !== undefined) {
        const suffix = externalPriced.has(asset) ? "†" : "";
        return priceMap[asset].toFixed(2) + suffix;
      }
      return "—";
    }

    function getEstValue(asset: string, amount: string): string {
      const balance = parseFloat(amount);
      if (asset === nativeFiat) return amount;  // already in quote currency, preserve Kraken precision
      if (asset.includes(".")) return "—";
      if (priceMap[asset] !== undefined) {
        const suffix = externalPriced.has(asset) ? "†" : "";
        return (priceMap[asset] * balance).toFixed(2) + suffix;
      }
      return "—";
    }

    if (opts.json) {
      const out: Record<string, any> = {};
      if (quoteCurrency) out.rates = quoteCurrency;
      for (const [asset, amount] of nonZero) {
        const entry: Record<string, any> = {
          amount,
          altname: displayName(asset, altnameMap[asset] ?? asset),
        };
        if (quoteCurrency) {
          const estStr = getEstValue(asset, amount);
          entry.price = priceMap[asset] ?? null;
          entry.est_value = estStr === "—" ? null : parseFloat(estStr.replace("†", ""));
        }
        out[asset] = entry;
      }
      writeJson(out);
      return;
    }

    if (quoteCurrency) {
      const headers = ["Asset", "Name", "Balance", `In ${quoteCurrency}`, "Price"];
      const rows = nonZero.map(([asset, amount]) => [
        asset,
        displayName(asset, altnameMap[asset] ?? asset),
        amount,
        getEstValue(asset, amount),
        getPrice(asset),
      ]);
      printTable(headers, rows);
      if (externalPriced.size > 0) {
        console.log("\n* Prices marked † sourced from CoinGecko");
      }
    } else {
      const headers = ["Asset", "Name", "Balance"];
      const rows = nonZero.map(([asset, amount]) => [
        asset,
        displayName(asset, altnameMap[asset] ?? asset),
        amount,
      ]);
      printTable(headers, rows);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
