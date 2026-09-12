import { monzoGet, requireSession } from "../client.js";
import { fetchTransactions, isOldRange, loadCache } from "./transactions.js";
import { buildMonzoStatement } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchAllTransactions(accountId: string, since?: string, before?: string): Promise<any[]> {
  const all: any[] = [];
  let lastId: string | undefined;
  while (true) {
    const batch = await fetchTransactions({ accountId, since: lastId ?? since, before, limit: 100, lastId });
    all.push(...batch);
    if (batch.length < 100) break;
    lastId = batch[batch.length - 1].id;
  }
  return all;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const session = await requireSession();
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);
    const isCurrentPeriod = period.end === todayStr;

    const sinceISO = `${period.start}T00:00:00.000Z`;
    const beforeISO = `${period.end}T23:59:59.999Z`;

    let periodTransactions: any[];
    if (isOldRange(sinceISO)) {
      const [year, month] = period.month.split("-").map(Number);
      const cached = loadCache(month, year);
      if (!cached) {
        throw new Error("Data older than 90 days requires a cached sync. Run: monzo transactions --cache");
      }
      periodTransactions = cached;
    } else {
      periodTransactions = await fetchAllTransactions(session.account_id, sinceISO, beforeISO);
    }

    const balanceData = await monzoGet(`/balance?account_id=${encodeURIComponent(session.account_id)}`);
    const currentBalancePence = balanceData.balance;
    const currency = balanceData.currency || "GBP";

    let flowsSincePeriodEndPence = 0;
    if (!isCurrentPeriod) {
      let afterPeriodTxs: any[];
      try {
        afterPeriodTxs = await fetchAllTransactions(session.account_id, beforeISO, undefined);
      } catch (fetchErr: any) {
        throw new Error(
          `Cannot derive the closing balance for ${monthStr}: Monzo requires recent authentication (SCA) to read transactions this old. ` +
            `Statements for months ending more than ~90 days ago are not currently supported. (${fetchErr.message})`
        );
      }
      flowsSincePeriodEndPence = afterPeriodTxs.reduce((s, t) => s + t.amount, 0);
    }

    const statement = buildMonzoStatement({
      accountId: session.account_id,
      period,
      currency,
      periodTransactions,
      currentBalancePence,
      flowsSincePeriodEndPence,
      isCurrentPeriod,
    });

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
