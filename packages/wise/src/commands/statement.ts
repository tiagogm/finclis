import { wiseGet, getProfileId } from "../client.js";
import { validateCurrency } from "../validate.js";
import { buildWiseStatement } from "../statement.js";
import { resolveStatementPeriod, currentMonthUTC, printStatement, writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface StatementOpts extends BaseCommandOpts {
  month?: string;
  currency?: string;
}

export async function statementCommand(opts: StatementOpts = {}): Promise<void> {
  try {
    const profileId = getProfileId();
    const monthStr = opts.month ?? currentMonthUTC();
    const period = resolveStatementPeriod(monthStr);

    const balances = await wiseGet(`/v4/profiles/${profileId}/balances?types=STANDARD`);
    if (!balances.length) {
      throw new Error("No balances found");
    }
    const currency = opts.currency ? validateCurrency(opts.currency) : undefined;
    const balance = currency ? balances.find((b: any) => b.currency === currency) : balances[0];
    if (!balance) {
      throw new Error(`No ${currency} balance found`);
    }
    const resolvedCurrency = balance.currency;
    const balanceId = balance.id || balance.balanceId;

    const params = new URLSearchParams({
      currency: resolvedCurrency,
      intervalStart: `${period.start}T00:00:00.000Z`,
      intervalEnd: `${period.end}T23:59:59.999Z`,
      type: "FLAT",
    });
    const url = `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?${params}`;
    const rawStatement = await wiseGet(url);

    const statement = buildWiseStatement({
      currency: resolvedCurrency,
      period,
      balanceId,
      currentBalanceAmount: balance.amount.value,
      statement: rawStatement,
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
