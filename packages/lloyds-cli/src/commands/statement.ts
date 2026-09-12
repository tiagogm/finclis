import { getClient, requireSession } from "../client.js";
import { readCachedTransactions, writeCachedTransactions } from "../cache.js";
import { isPastMonth } from "../validate.js";
import { buildLloydsStatement } from "../aggregator.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  cache?: boolean; // Commander --no-cache sets this to false
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const monthStr = opts.month ?? currentMonthString();
    const period = resolveStatementPeriod(monthStr);
    const monthKey = period.month;
    const [year, mon] = monthKey.split("-").map(Number);
    const isPast = isPastMonth(year, mon);
    const useCache = opts.cache !== false;

    let rawTxns: any[] | null = isPast && useCache ? readCachedTransactions(monthKey) : null;

    const client = await getClient();
    let accounts: any[];
    if (rawTxns) {
      accounts = await client.getAccounts();
    } else {
      [rawTxns, accounts] = await Promise.all([
        client.fetchAllTransactions(monthKey),
        client.getAccounts(),
      ]);
      if (isPast) writeCachedTransactions(monthKey, rawTxns);
    }

    const currentBalance = accounts[0]?.balanceAmount?.amount ?? 0;
    const statement = buildLloydsStatement(rawTxns, currentBalance, period, session.arrangementId);

    if (opts.json) {
      writeJson(statement);
      return;
    }
    printStatement(statement);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
