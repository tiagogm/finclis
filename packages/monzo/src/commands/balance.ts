import { monzoGet, requireSession } from "../client.js";
import { formatMoney } from "../format.js";
import { writeJson, handleJsonError } from "../json.js";
import type { BaseCommandOpts } from "../json.js";

export async function balanceCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const session = await requireSession();
    const data = await monzoGet(`/balance?account_id=${encodeURIComponent(session.account_id)}`);

    if (opts.json) {
      writeJson(data);
      return;
    }

    const currency = data.currency || "GBP";
    console.log(`Balance:       ${formatMoney(data.balance, currency)}`);
    console.log(`Total:         ${formatMoney(data.total_balance, currency)}  (includes pots)`);
    console.log(`Spent today:   ${formatMoney(Math.abs(data.spend_today), currency)}`);
    console.log(`Currency:      ${currency}`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
