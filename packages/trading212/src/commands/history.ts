import { t212GetAll } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import { Command } from "commander";
import { summaryCommand } from "./summary.js";

export function registerHistoryCommand(program: Command): void {
  const history = program
    .command("history")
    .description("Historical data (orders, dividends, exports)")
    .action(function () { history.help(); });

  history
    .command("orders")
    .description("Past filled/cancelled orders")
    .option("--json", "Output raw JSON")
    .option("-v, --verbose", "Log HTTP requests")
    .action(historyOrdersCommand);

  history
    .command("dividends")
    .description("Dividend payment history")
    .option("--json", "Output raw JSON")
    .option("-v, --verbose", "Log HTTP requests")
    .action(historyDividendsCommand);

  history
    .command("export")
    .description("Monthly cash-flow summary via CSV export (~15–30s)")
    .option("--month <MM-YYYY>", "Specific month (default: current)")
    .option("--year <YYYY>", "Full year table")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--json", "Output raw JSON")
    .option("-v, --verbose", "Log HTTP requests")
    .action(summaryCommand);

}

async function historyOrdersCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const items = await t212GetAll("/equity/history/orders");

    if (opts.json) {
      writeJson(items);
      return;
    }

    if (!items.length) {
      console.log("No historical orders found.");
      return;
    }

    console.log(
      `${"ID".padEnd(12)} ${"Ticker".padEnd(12)} ${"Type".padEnd(10)} ${"Qty".padStart(10)} ${"Price".padStart(12)} ${"Status".padEnd(12)} Date`
    );
    console.log("-".repeat(85));
    for (const o of items) {
      const price = o.fillPrice != null ? o.fillPrice.toFixed(4) : "-";
      const date = o.dateModified ? o.dateModified.slice(0, 10) : "-";
      console.log(
        `${String(o.id).padEnd(12)} ${String(o.ticker).padEnd(12)} ${String(o.type).padEnd(10)} ${String(o.filledQuantity ?? o.quantity ?? "-").padStart(10)} ${price.padStart(12)} ${String(o.status).padEnd(12)} ${date}`
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function historyDividendsCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const items = await t212GetAll("/equity/history/dividends");

    if (opts.json) {
      writeJson(items);
      return;
    }

    if (!items.length) {
      console.log("No dividend history found.");
      return;
    }

    console.log(
      `${"Ticker".padEnd(12)} ${"Amount".padStart(12)} ${"Shares".padStart(10)} ${"Type".padEnd(12)} Date`
    );
    console.log("-".repeat(60));
    for (const d of items) {
      const amount = d.amount != null ? d.amount.toFixed(4) : "-";
      const shares = d.quantity != null ? d.quantity.toFixed(4) : "-";
      const date = d.paidOn ? d.paidOn.slice(0, 10) : "-";
      console.log(
        `${String(d.ticker).padEnd(12)} ${amount.padStart(12)} ${shares.padStart(10)} ${String(d.type ?? "-").padEnd(12)} ${date}`
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

