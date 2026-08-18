import { krakenPrivatePost } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import { printTable } from "../display.js";
import { prompt } from "../auth.js";

interface CancelOpts extends BaseCommandOpts {
  yes?: boolean;
  all?: boolean;
}

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

    const headers = ["Date", "Pair", "Side", "Type", "Price", "Volume", "ID"];
    const rows = entries.map(([txid, order]) => {
      const d = order.descr;
      const date = new Date(order.opentm * 1000).toISOString().slice(0, 10);
      return [date, d.pair, d.type, d.ordertype, d.price, order.vol, txid];
    });
    printTable(headers, rows);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

export async function cancelCommand(txid: string | undefined, opts: CancelOpts = {}): Promise<void> {
  if (opts.all && txid) {
    console.error("Cannot specify a txid with --all.");
    process.exit(1);
  }
  if (!opts.all && !txid) {
    console.error("Provide a transaction ID, or use --all to cancel all open orders.");
    process.exit(1);
  }

  try {
    if (opts.all) {
      if (!opts.yes) {
        const answer = await prompt("Cancel ALL open orders? (y/N): ");
        if (answer.trim().toLowerCase() !== "y") {
          console.log("Aborted.");
          return;
        }
      }
      const result = await krakenPrivatePost("/0/private/CancelAll", {});
      if (opts.json) { writeJson(result); return; }
      console.log(`Cancelled ${result.count} orders.`);
      return;
    }

    if (!opts.yes) {
      const answer = await prompt(`Cancel order ${txid}? (y/N): `);
      if (answer.trim().toLowerCase() !== "y") {
        console.log("Aborted.");
        return;
      }
    }

    const result = await krakenPrivatePost("/0/private/CancelOrder", { txid: txid! });

    if (opts.json) { writeJson(result); return; }

    if (result.pending) {
      console.log("Order cancellation pending.");
    } else {
      console.log(`Cancelled ${result.count} order${result.count !== 1 ? "s" : ""}.`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

interface QueryOpts extends BaseCommandOpts {
  open?: boolean;
}

function renderOrdersTable(entries: [string, any][]): void {
  const headers = ["Status", "Date", "Pair", "Side", "Type", "Price", "Volume", "ID"];
  const rows = entries.map(([txid, order]) => {
    const d = order.descr;
    const ts = order.closetm && order.closetm !== 0 ? order.closetm : order.opentm;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    return [order.status, date, d.pair, d.type, d.ordertype, d.price, order.vol, txid];
  });
  printTable(headers, rows);
}

export async function queryCommand(txids: string[], opts: QueryOpts = {}): Promise<void> {
  if (!txids.length && !opts.open) {
    console.error("Provide one or more transaction IDs, or use --open to list all open orders.");
    process.exit(1);
  }

  try {
    if (opts.open) {
      const result = await krakenPrivatePost("/0/private/OpenOrders", {});
      const open = result.open as Record<string, any>;
      if (opts.json) { writeJson(open); return; }
      const entries = Object.entries(open);
      if (entries.length === 0) { console.log("No open orders."); return; }
      renderOrdersTable(entries);
      return;
    }

    const result = await krakenPrivatePost("/0/private/QueryOrders", { txid: txids.join(",") });

    if (opts.json) {
      writeJson(result);
      return;
    }

    const entries = Object.entries(result as Record<string, any>);
    if (entries.length === 0) { console.log("No orders found."); return; }
    renderOrdersTable(entries);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
