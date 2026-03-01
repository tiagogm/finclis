import { wiseGet } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function transferCommand(id: string, opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const transfer = await wiseGet(`/v1/transfers/${id}`);

    if (opts.json) {
      writeJson(transfer);
      return;
    }

    const rows: [string, string][] = [
      ["Transfer ID", String(transfer.id)],
      ["Status", transfer.status],
      ["Source", `${transfer.sourceValue} ${transfer.sourceCurrency}`],
      ["Target", `${transfer.targetValue} ${transfer.targetCurrency}`],
      ["Rate", String(transfer.rate)],
      ["Created", transfer.created],
      ["Recipient", String(transfer.targetAccount)],
    ];

    if (transfer.details?.reference) {
      rows.push(["Reference", transfer.details.reference]);
    }

    if (transfer.hasActiveIssues) {
      rows.push(["Issues", "Yes — check wise.com"]);
    }

    if (transfer.customerTransactionId) {
      rows.push(["Transaction ID", transfer.customerTransactionId]);
    }

    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, value] of rows) {
      console.log(`${key.padEnd(maxKey + 2)}${value}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
