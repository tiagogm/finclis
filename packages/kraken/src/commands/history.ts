import { krakenPrivatePost } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface HistoryOpts extends BaseCommandOpts {
  pair?: string;
  limit?: string;
}

export async function historyCommand(opts: HistoryOpts = {}): Promise<void> {
  try {
    const params: Record<string, string> = {};
    if (opts.pair) params.pair = opts.pair;

    const result = await krakenPrivatePost("/0/private/ClosedOrders", params);
    const closed = result.closed as Record<string, any>;

    let entries = Object.entries(closed);
    const limit = parseInt(opts.limit || "20", 10);
    entries = entries.slice(0, limit);

    if (opts.json) {
      writeJson(Object.fromEntries(entries));
      return;
    }

    if (entries.length === 0) {
      console.log("No closed orders found.");
      return;
    }

    console.log("ID\t\t\t\tPair\t\tSide\tExec Price\tVolume\t\tClosed");
    console.log("--\t\t\t\t----\t\t----\t----------\t------\t\t------");
    for (const [txid, order] of entries) {
      const d = order.descr;
      const closed = new Date(order.closetm * 1000).toISOString().slice(0, 10);
      const execPrice = order.price || "0";
      console.log(`${txid}\t${d.pair}\t\t${d.type}\t${execPrice}\t\t${order.vol_exec}\t\t${closed}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
