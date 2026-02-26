import { wiseGet, getProfileId } from "../client.js";
import { validateCurrency, validateDate } from "../validate.js";

interface StatementOpts {
  currency: string;
  from: string;
  to: string;
}

export async function statementsCommand(opts: StatementOpts): Promise<void> {
  try {
    const profileId = getProfileId();
    const currency = validateCurrency(opts.currency);
    const fromDate = validateDate(opts.from);
    const toDate = validateDate(opts.to);

    const balances = await wiseGet(
      `/v4/profiles/${profileId}/balances?types=STANDARD`
    );
    const balance = balances.find((b: any) => b.currency === currency);
    if (!balance) {
      console.error(`No ${currency} balance found`);
      process.exit(1);
    }

    const balanceId = balance.id || balance.balanceId;

    const params = new URLSearchParams({
      currency,
      intervalStart: new Date(fromDate).toISOString(),
      intervalEnd: new Date(toDate).toISOString(),
      type: "FLAT",
    });

    const url = `/v3/profiles/${profileId}/balance-statements/${balanceId}/statement/flat?${params}`;
    const statement = await wiseGet(url);

    if (!statement.transactions || statement.transactions.length === 0) {
      console.log("No transactions found.");
      return;
    }

    for (const tx of statement.transactions) {
      const date = tx.date.slice(0, 10);
      const amount = tx.amount.value.toFixed(2);
      const desc = tx.details.description || tx.details.type;
      console.log(`${date}\t${amount}\t${tx.amount.currency}\t${desc}`);
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
