import { getClient, requireSession } from "../client.js";
import { readCachedTransactions, writeCachedTransactions } from "../cache.js";
import { isPastMonth } from "../validate.js";
import { buildLloydsStatement } from "../aggregator.js";
import {
  currentMonthUTC,
  resolveStatementPeriod,
  printStatement,
  writeJson,
  handleJsonError,
} from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  cache?: boolean; // Commander --no-cache sets this to false
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const monthStr = opts.month ?? currentMonthUTC();
    const period = resolveStatementPeriod(monthStr);
    const monthKey = period.month;
    const [year, mon] = monthKey.split("-").map(Number);
    const isPast = isPastMonth(year, mon);
    const useCache = opts.cache !== false;

    let rawTxns: any[] | null = isPast && useCache ? readCachedTransactions(monthKey) : null;

    const client = await getClient();
    if (!rawTxns) {
      rawTxns = await client.fetchAllTransactions(monthKey);
      if (isPast) writeCachedTransactions(monthKey, rawTxns);
    }

    // currentBalance is only read by buildLloydsStatement when the
    // transaction list is empty, so only pay for the live accounts call then.
    let currentBalance = 0;
    if (rawTxns.length === 0) {
      const accounts = await client.getAccounts();
      currentBalance = accounts[0]?.balanceAmount?.amount ?? 0;
    }

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
