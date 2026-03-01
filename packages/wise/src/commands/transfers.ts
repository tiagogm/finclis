import { wiseGet, getProfileId } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function transfersCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const profileId = getProfileId();
    const transfers = await wiseGet(
      `/v1/transfers?profile=${profileId}&limit=20&offset=0`
    );

    if (opts.json) {
      writeJson(transfers);
      return;
    }

    if (!Array.isArray(transfers) || transfers.length === 0) {
      console.log("No transfers found.");
      return;
    }

    for (const t of transfers) {
      const created = t.created.slice(0, 10);
      const source = `${t.sourceValue} ${t.sourceCurrency}`;
      const target = `${t.targetValue} ${t.targetCurrency}`;
      const status = t.status;
      console.log(`[${t.id}]\t${created}\t${source} → ${target}\t${status}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
