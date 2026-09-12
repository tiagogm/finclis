import { krakenPrivatePost } from "../client.js";
import { buildKrakenStatement, type LedgerEntry } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  asset?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultFiatAsset(balances: Record<string, string>): string {
  const fiat = Object.entries(balances).find(([asset, amt]) => asset.startsWith("Z") && parseFloat(amt) !== 0);
  if (!fiat) {
    throw new Error("No default fiat balance found — specify an asset explicitly with --asset (e.g. --asset XXBT).");
  }
  return fiat[0];
}

async function fetchAllLedgerEntries(asset: string, startSec: number, endSec: number): Promise<[string, LedgerEntry][]> {
  const all: [string, LedgerEntry][] = [];
  let ofs = 0;
  while (true) {
    const result = await krakenPrivatePost("/0/private/Ledgers", {
      asset,
      start: String(startSec),
      end: String(endSec),
      ofs: String(ofs),
    });
    const entries = Object.entries(result.ledger as Record<string, LedgerEntry>);
    all.push(...entries);
    if (entries.length === 0) break;
    ofs += entries.length;
    const total = result.count as number;
    if (ofs >= total) break;
  }
  return all;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);

    const balances = await krakenPrivatePost("/0/private/Balance", {});
    const assetCode = opts.asset ? opts.asset.toUpperCase() : defaultFiatAsset(balances);
    if (!(assetCode in balances)) {
      throw new Error(`No balance found for asset "${assetCode}".`);
    }
    const currentBalance = parseFloat(balances[assetCode]);

    const periodStartSec = Math.floor(new Date(`${period.start}T00:00:00.000Z`).getTime() / 1000);
    const periodEndSec = Math.floor(new Date(`${period.end}T23:59:59.999Z`).getTime() / 1000);
    const nowSec = Math.floor(Date.now() / 1000);

    const periodEntries = await fetchAllLedgerEntries(assetCode, periodStartSec, periodEndSec);
    const afterEntries =
      periodEndSec < nowSec ? await fetchAllLedgerEntries(assetCode, periodEndSec + 1, nowSec) : [];

    const statement = buildKrakenStatement({
      period,
      assetCode,
      periodEntries,
      afterEntries,
      currentBalance,
    });

    if (opts.json) {
      writeJson(statement);
      return;
    }
    printStatement(statement);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
