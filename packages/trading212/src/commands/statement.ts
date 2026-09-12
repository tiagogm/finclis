import { t212Get } from "../client.js";
import { fetchCSV } from "./summary.js";
import { parseTransactionsCSV } from "../csv.js";
import { buildTrading212Statement } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);

    const fromDate = `${period.start}T00:00:00.000Z`;
    const toDate = `${todayStr}T23:59:59.999Z`;

    const csvContent = await fetchCSV(fromDate, toDate);
    const allTxns = parseTransactionsCSV(csvContent);

    const periodTxns = allTxns.filter((t) => {
      const d = t.date.slice(0, 10);
      return d >= period.start && d <= period.end;
    });
    const afterPeriodTxns = allTxns.filter((t) => t.date.slice(0, 10) > period.end);

    const [cash, accountInfo] = await Promise.all([
      t212Get("/equity/account/cash"),
      t212Get("/equity/account/info"),
    ]);
    const currency: string = accountInfo.currencyCode ?? "GBP";

    const statement = buildTrading212Statement({
      period,
      currency,
      periodTxns,
      afterPeriodTxns,
      currentCashFree: cash.free,
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
