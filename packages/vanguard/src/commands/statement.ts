import { vanguardGet, requireSession } from "../client.js";
import { parseVanguardMonthLabel } from "../cache.js";
import { buildVanguardStatement } from "../statement.js";
import { resolveStatementPeriod, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
}

function currentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function findMonthData(months: any[], targetMonth: string): any | undefined {
  return months.find((m) => {
    const parsed = parseVanguardMonthLabel(m.Month ?? "");
    if (!parsed) return false;
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    return key === targetMonth;
  });
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const monthStr = opts.month ?? currentMonthString();
    const todayStr = new Date().toISOString().slice(0, 10);
    const period = resolveStatementPeriod(monthStr, todayStr);

    const hId = session.hierarchyId;
    const fromDate = `${period.start}T00:00:00.000Z`;
    const toDate = `${period.end}T23:59:59.999Z`;

    const [perfData, cashBalance] = await Promise.all([
      vanguardGet(
        `/en-GB/Api/Performance/InvestmentMonthlyPerformance/Get?hierarchyId=${hId}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`
      ),
      vanguardGet(`/en-GB/SubAccount/${hId}/Api/Portfolio/CashBalance/Get?hierarchyId=${hId}`),
    ]);

    const months: any[] = Array.isArray(perfData) ? perfData : [];
    const monthData = months.length === 1 ? months[0] : findMonthData(months, period.month);

    const statement = buildVanguardStatement({
      period,
      monthData,
      cashBalanceAmount: cashBalance.Amount ?? 0,
      today: todayStr,
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
