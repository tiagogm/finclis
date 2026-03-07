import { monzoGet } from "../client.js";
import { writeJson, handleJsonError } from "../json.js";
import type { BaseCommandOpts } from "../json.js";

export async function transactionCommand(id: string, opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const data = await monzoGet(`/transactions/${encodeURIComponent(id)}?expand[]=merchant`);
    const tx = data.transaction || data;

    if (opts.json) {
      writeJson(tx);
      return;
    }

    for (const [key, value] of Object.entries(tx)) {
      if (value === null || value === undefined) continue;
      const strVal =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      console.log(`${key.padEnd(20)} ${strVal}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
