import { getClient, requireSession } from "../client.js";
import { validateMonth, isPastMonth, currentMonthKey, formatGBP } from "../validate.js";
import { readCachedTransactions, writeCachedTransactions } from "../cache.js";
import { mapTransaction, TransactionType } from "../aggregator.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface TransactionsOpts extends BaseCommandOpts {
  month?: string;
  cache?: boolean; // Commander --no-cache sets this to false
}

export async function transactionsCommand(opts: TransactionsOpts): Promise<void> {
  requireSession();

  try {
    const monthKey = opts.month
      ? validateMonth(opts.month).key
      : currentMonthKey();
    const [year, mon] = monthKey.split("-").map(Number);
    const isPast = isPastMonth(year, mon);
    const useCache = opts.cache !== false;

    // Serve from cache for past months
    if (isPast && useCache) {
      const cached = readCachedTransactions(monthKey);
      if (cached) {
        process.stderr.write("[cached] Use --no-cache to refresh.\n");
        const mapped = cached.map(mapTransaction);
        if (opts.json) {
          writeJson(mapped);
          return;
        }
        printTransactions(mapped);
        return;
      }
    }

    const client = await getClient();
    const rawTxns = await client.fetchAllTransactions(monthKey);

    if (isPast) {
      writeCachedTransactions(monthKey, rawTxns);
    }

    const mapped = rawTxns.map(mapTransaction);

    if (opts.json) {
      writeJson(mapped);
      return;
    }

    printTransactions(mapped);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}


function printTransactions(txns: ReturnType<typeof mapTransaction>[]): void {
  if (txns.length === 0) {
    console.log("No transactions found.");
    return;
  }

  for (const t of txns) {
    const date = t.date.split("T")[0];
    const isCredit =
      t.type === TransactionType.DEPOSIT || t.type === TransactionType.INTEREST;
    const sign = isCredit ? "+" : "-";
    const amount = `${sign}£${formatGBP(t.amount)}`.padStart(14);
    console.log(`${date}  ${amount}  ${t.description}`);
  }
}
