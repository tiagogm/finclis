import { krakenPrivatePost } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function balancesCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const result = await krakenPrivatePost("/0/private/Balance", {});

    const nonZero = Object.entries(result as Record<string, string>)
      .filter(([, amount]) => parseFloat(amount) !== 0);

    if (opts.json) {
      writeJson(Object.fromEntries(nonZero));
      return;
    }

    if (nonZero.length === 0) {
      console.log("No balances found.");
      return;
    }

    console.log("Asset\t\tBalance");
    console.log("-----\t\t-------");
    for (const [asset, amount] of nonZero) {
      console.log(`${asset}\t\t${amount}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
