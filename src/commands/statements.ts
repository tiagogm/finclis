import { wiseGet, getProfileId } from "../client.js";

interface StatementOpts {
  currency: string;
  from: string;
  to: string;
}

export async function statementsCommand(opts: StatementOpts): Promise<void> {
  try {
    const profileId = getProfileId();
    const currency = opts.currency.toUpperCase();

    // First get the balance ID for this currency
    const balances = await wiseGet(
      `/v4/profiles/${profileId}/balances?types=STANDARD`
    );
    const balance = balances.find((b: any) => b.currency === currency);
    if (!balance) {
      console.error(`No ${currency} balance found`);
      process.exit(1);
    }

    // Fetch statement — this endpoint requires SCA
    const params = new URLSearchParams({
      currency,
      intervalStart: new Date(opts.from).toISOString(),
      intervalEnd: new Date(opts.to).toISOString(),
      type: "FLAT",
    });

    const statement = await wiseGet(
      `/v3/profiles/${profileId}/balance-statements/${balance.id}/statement/flat?${params}`
    );

    // Print transactions
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
