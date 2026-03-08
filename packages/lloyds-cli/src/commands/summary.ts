import { getClient, requireSession } from "../client.js";
import {
  parseMonth,
  isPastMonth,
  currentMonthKey,
  formatGBP,
} from "../validate.js";
import { readCachedSummary, writeCachedSummary, writeCachedTransactions } from "../cache.js";
import {
  mapTransaction,
  buildFinancialSummary,
  type FinancialSummary,
} from "../aggregator.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface SummaryOpts extends BaseCommandOpts {
  month?: string;
  cache?: boolean; // Commander --no-cache sets this to false
}

export async function summaryCommand(opts: SummaryOpts): Promise<void> {
  requireSession();

  try {
    let monthKey: string;
    if (opts.month) {
      const parsed = parseMonth(opts.month);
      if (!parsed) {
        console.error(`Invalid month: "${opts.month}". Expected MM-YYYY (e.g. 01-2026).`);
        process.exit(0);
      }
      monthKey = parsed.key;
    } else {
      monthKey = currentMonthKey();
    }

    const [year, mon] = monthKey.split("-").map(Number);
    const isPast = isPastMonth(year, mon);
    const useCache = opts.cache !== false;

    // Serve from cache for past months
    if (isPast && useCache) {
      const cached = readCachedSummary(monthKey);
      if (cached) {
        process.stderr.write("[cached] Use --no-cache to refresh.\n");
        if (opts.json) {
          writeJson(cached);
          return;
        }
        printSummary(cached);
        return;
      }
    }

    const client = await getClient();
    const [rawTxns, accounts] = await Promise.all([
      client.fetchAllTransactions(monthKey),
      client.getAccounts(),
    ]);
    const transactions = rawTxns.map(mapTransaction);
    const currentBalance = accounts[0]?.balanceAmount?.amount ?? 0;

    const summary = buildFinancialSummary(
      transactions,
      rawTxns,
      currentBalance,
      monthKey
    );

    if (isPast) {
      writeCachedTransactions(monthKey, rawTxns);
      writeCachedSummary(monthKey, summary);
    }

    if (opts.json) {
      writeJson(summary);
      return;
    }

    printSummary(summary);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}


function printSummary(s: FinancialSummary): void {
  const changeSign = s.balances.change >= 0 ? "+" : "";
  const netSign = s.cashFlow.net >= 0 ? "+" : "";

  console.log(`Period:      ${s.period.name}`);
  console.log(`Opening:     £${formatGBP(s.balances.opening)}`);
  console.log(`Closing:     £${formatGBP(s.balances.closing)}`);
  console.log(
    `Change:      ${changeSign}£${formatGBP(Math.abs(s.balances.change))} (${changeSign}${(s.balances.changePercent * 100).toFixed(2)}%)`
  );
  console.log(`---`);
  console.log(`Deposits:    £${formatGBP(s.cashFlow.deposits)}`);
  console.log(`Withdrawals: £${formatGBP(s.cashFlow.withdrawals)}`);
  console.log(`Net Cash:    ${netSign}£${formatGBP(Math.abs(s.cashFlow.net))}`);
  if (s.passiveIncome.interest > 0) {
    console.log(`Interest:    £${formatGBP(s.passiveIncome.interest)}`);
  }
}
