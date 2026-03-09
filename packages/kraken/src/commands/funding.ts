import { krakenPrivatePost } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface FundingOpts extends BaseCommandOpts {
  type?: string;
}

export async function fundingCommand(opts: FundingOpts = {}): Promise<void> {
  try {
    const params: Record<string, string> = {};
    if (opts.type) params.type = opts.type;

    const result = await krakenPrivatePost("/0/private/Ledgers", params);
    const allEntries = Object.entries(result.ledger as Record<string, any>);

    // When no --type given, filter client-side to deposit/withdrawal only
    const entries = opts.type
      ? allEntries
      : allEntries.filter(([, e]) => ["deposit", "withdrawal"].includes(e.type));

    if (opts.json) {
      writeJson(Object.fromEntries(entries));
      return;
    }

    if (entries.length === 0) {
      console.log("No funding entries found.");
      return;
    }

    console.log("ID\t\t\t\tDate\t\tType\t\tAsset\tAmount\t\tFee");
    console.log("--\t\t\t\t----\t\t----\t\t-----\t------\t\t---");
    for (const [id, entry] of entries) {
      const date = new Date(entry.time * 1000).toISOString().slice(0, 10);
      console.log(`${id}\t${date}\t${entry.type}\t\t${entry.asset}\t${entry.amount}\t\t${entry.fee}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
