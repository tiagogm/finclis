import { getClient, requireSession } from "../client.js";
import { formatGBP } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function balanceCommand(opts: BaseCommandOpts = {}): Promise<void> {
  requireSession();

  try {
    const client = await getClient();
    const accounts = await client.getAccounts();

    if (accounts.length === 0) {
      throw new Error("No accounts found.");
    }

    const bal = accounts[0].balanceAmount;

    if (opts.json) {
      writeJson(bal);
      return;
    }

    console.log(`Balance:         £${formatGBP(bal.amount)}`);
    console.log(`Available:       £${formatGBP(bal.remainingOverdraft)}`);
    console.log(`Overdraft Limit: £${formatGBP(bal.overdraftLimit)}`);
    console.log(`Currency:        ${bal.currency}`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
