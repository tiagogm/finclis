import { krakenPrivatePost } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function ordersCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const result = await krakenPrivatePost("/0/private/OpenOrders", {});
    const open = result.open as Record<string, any>;

    if (opts.json) {
      writeJson(open);
      return;
    }

    const entries = Object.entries(open);
    if (entries.length === 0) {
      console.log("No open orders.");
      return;
    }

    console.log("ID\t\t\t\tPair\t\tSide\tType\tPrice\t\tVolume\t\tOpened");
    console.log("--\t\t\t\t----\t\t----\t----\t-----\t\t------\t\t------");
    for (const [txid, order] of entries) {
      const d = order.descr;
      const opened = new Date(order.opentm * 1000).toISOString().slice(0, 10);
      console.log(`${txid}\t${d.pair}\t\t${d.type}\t${d.ordertype}\t${d.price}\t\t${order.vol}\t\t${opened}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
