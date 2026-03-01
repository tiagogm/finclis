import { wiseGet, getProfileId } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function balancesCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const profileId = getProfileId();
    const balances = await wiseGet(
      `/v4/profiles/${profileId}/balances?types=STANDARD,SAVINGS`
    );

    if (opts.json) {
      writeJson(balances);
      return;
    }

    // Header
    console.log("ID\tType\tCurrency\tBalance");
    console.log("--\t----\t--------\t-------");

    for (const b of balances) {
      const id = b.id || b.balanceId || "?";
      const type = b.type || "STANDARD";
      const currency = b.currency;
      const amount = b.amount.value.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      console.log(`${id}\t${type}\t${currency}\t\t${amount}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
