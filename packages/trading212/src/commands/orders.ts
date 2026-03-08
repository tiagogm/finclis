import { t212Get } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function ordersCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const orders = await t212Get("/equity/orders");

    if (opts.json) {
      writeJson(orders);
      return;
    }

    if (!orders.length) {
      console.log("No pending orders.");
      return;
    }

    console.log(
      `${"ID".padEnd(12)} ${"Ticker".padEnd(12)} ${"Type".padEnd(10)} ${"Qty".padStart(10)} ${"Limit".padStart(12)} ${"Status".padEnd(12)}`
    );
    console.log("-".repeat(72));
    for (const o of orders) {
      const limit = o.limitPrice != null ? o.limitPrice.toFixed(4) : "-";
      console.log(
        `${String(o.id).padEnd(12)} ${String(o.ticker).padEnd(12)} ${String(o.type).padEnd(10)} ${String(o.quantity ?? "-").padStart(10)} ${limit.padStart(12)} ${String(o.status).padEnd(12)}`
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
