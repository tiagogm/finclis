import { monzoGet, requireSession } from "../client.js";
import { fetchAllTransactionsPaginated, isOldRange, loadCache } from "./transactions.js";
import { buildMonzoStatement } from "../statement.js";
import { resolveStatementPeriod, currentMonthUTC, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const session = await requireSession();
    const monthStr = opts.month ?? currentMonthUTC();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);
    const isCurrentPeriod = period.end === todayStr;

    const sinceISO = `${period.start}T00:00:00.000Z`;
    const beforeISO = `${period.end}T23:59:59.999Z`;

    let periodTransactions: any[];
    if (isOldRange(sinceISO)) {
      const [year, month] = period.month.split("-").map(Number);
      const cached = loadCache(session.account_id, month, year);
      if (!cached) {
        throw new Error("Data older than 90 days requires a cached sync. Run: monzo transactions --cache");
      }
      periodTransactions = cached;
    } else {
      periodTransactions = await fetchAllTransactionsPaginated({
        accountId: session.account_id,
        since: sinceISO,
        before: beforeISO,
      });
    }

    const balanceData = await monzoGet(`/balance?account_id=${encodeURIComponent(session.account_id)}`);
    const currentBalancePence = balanceData.balance;
    const currency = balanceData.currency || "GBP";

    // Best-effort: label the statement with the real account description
    // (e.g. "Joint Account"). An /accounts failure must not fail an
    // otherwise-servable statement, so fall back to the generic name.
    let accountName: string | undefined;
    try {
      const accountsData = await monzoGet("/accounts");
      accountName = (accountsData.accounts || []).find((a: any) => a.id === session.account_id)?.description;
    } catch {}

    let flowsSincePeriodEndPence = 0;
    if (!isCurrentPeriod) {
      let afterPeriodTxs: any[];
      try {
        afterPeriodTxs = await fetchAllTransactionsPaginated({
          accountId: session.account_id,
          since: beforeISO,
        });
      } catch (fetchErr: any) {
        // Only the known 403/SCA case should be re-labeled; other failures
        // (network, rate limits, 5xx) are retryable service problems and must
        // surface as themselves.
        if (!fetchErr?.message?.includes("403")) throw fetchErr;
        throw new Error(
          `Cannot derive the closing balance for ${monthStr}: Monzo requires recent authentication (SCA) to read transactions this old. ` +
            `Statements for months ending more than ~90 days ago are not currently supported. (${fetchErr.message})`
        );
      }
      flowsSincePeriodEndPence = afterPeriodTxs.reduce((s, t) => s + t.amount, 0);
    }

    const statement = buildMonzoStatement({
      accountId: session.account_id,
      accountName,
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
