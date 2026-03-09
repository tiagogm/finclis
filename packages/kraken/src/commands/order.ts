import { krakenPrivatePost } from "../client.js";
import { prompt } from "../auth.js";
import { handleJsonError } from "@finclis/cli-utils";

interface OrderOpts {
  pair?: string;
  side?: string;
  type?: string;
  amount?: string;
  price?: string;
  yes?: boolean;
  json?: boolean;
  verbose?: boolean;
}

export async function orderCommand(opts: OrderOpts = {}): Promise<void> {
  try {
    const pair = opts.pair || await prompt("Pair (e.g. XBTUSD): ");
    const side = opts.side || await prompt("Side (buy/sell): ");
    const ordertype = opts.type || await prompt("Type (market/limit): ");
    const volume = opts.amount || await prompt("Amount (volume): ");

    // Validation
    if (!["buy", "sell"].includes(side)) {
      console.error(`Invalid side "${side}". Must be buy or sell.`);
      process.exit(1);
    }
    if (!["market", "limit"].includes(ordertype)) {
      console.error(`Invalid type "${ordertype}". Must be market or limit.`);
      process.exit(1);
    }
    if (isNaN(parseFloat(volume)) || parseFloat(volume) <= 0) {
      console.error("Amount must be a positive number.");
      process.exit(1);
    }

    let price: string | undefined;
    if (ordertype === "limit") {
      if (opts.yes && !opts.price) {
        // In non-interactive mode (--yes), price must be provided as a flag
        console.error("A price is required for limit orders. Use --price <price>.");
        process.exit(1);
      }
      price = opts.price || await prompt("Limit price: ");
      if (!price || !price.trim()) {
        console.error("A price is required for limit orders.");
        process.exit(1);
      }
    }

    // Print summary
    console.log("\nOrder summary:");
    console.log(`  Pair:   ${pair}`);
    console.log(`  Side:   ${side}`);
    console.log(`  Type:   ${ordertype}`);
    console.log(`  Volume: ${volume}`);
    if (price) console.log(`  Price:  ${price}`);
    console.log();

    if (!opts.yes) {
      const confirm = await prompt("Submit this order? (y/N): ");
      if (confirm.trim().toLowerCase() !== "y") {
        console.log("Order cancelled.");
        return;
      }
    }

    const params: Record<string, string> = {
      pair,
      type: side,
      ordertype,
      volume,
    };
    if (price) params.price = price;

    const result = await krakenPrivatePost("/0/private/AddOrder", params);

    console.log(`Order placed: ${result.txid?.join(", ") || "unknown"}`);
    if (result.descr?.order) console.log(`Description: ${result.descr.order}`);
  } catch (err: any) {
    if (err.message === "exit") throw err;
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
