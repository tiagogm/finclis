#!/usr/bin/env node
import { Command } from "commander";
import { authSetCommand, authViewCommand, authClearCommand } from "./commands/auth.js";
import { whoamiCommand } from "./commands/whoami.js";
import { cashCommand } from "./commands/cash.js";
import { positionsCommand } from "./commands/positions.js";
import { ordersCommand } from "./commands/orders.js";
import { registerHistoryCommand } from "./commands/history.js";
import { instrumentsCommand } from "./commands/instruments.js";
import { summaryCommand } from "./commands/summary.js";
import { setVerbose } from "./client.js";

const program = new Command();

program
  .name("trading212")
  .description("Unofficial CLI for Trading212")
  .version("0.1.0");

program.hook("preAction", (_thisCommand, actionCommand) => {
  if (actionCommand.opts().verbose) {
    setVerbose(true);
  }
});

// Auth
const auth = program
  .command("auth")
  .description("Manage Trading212 API credentials")
  .action(function (this: Command) {
    this.help();
  });

auth
  .command("set")
  .description("Set API key and secret")
  .option("-v, --verbose", "Log HTTP requests")
  .action(authSetCommand);

auth
  .command("view")
  .description("Show stored credentials")
  .action(authViewCommand);

auth
  .command("clear")
  .description("Remove stored credentials")
  .action(authClearCommand);

program
  .command("whoami")
  .description("Show account info")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(whoamiCommand);

// Account
program
  .command("cash")
  .description("Show account cash balance")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(cashCommand);

program
  .command("positions")
  .description("List open positions")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(positionsCommand);

program
  .command("orders")
  .description("List pending orders")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(ordersCommand);

// History sub-commands (orders, dividends — transactions require CSV export, not available via REST)
registerHistoryCommand(program);

// Summary (alias of history export)
program
  .command("summary")
  .description("Alias of `history export` — monthly cash-flow via CSV export (~15–30s)")
  .option("--month <MM-YYYY>", "Specific month (default: current)")
  .option("--year <YYYY>", "Full year table")
  .option("--from <YYYY-MM-DD>", "Start date")
  .option("--to <YYYY-MM-DD>", "End date")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  trading212 summary\n  trading212 summary --month 03-2026\n  trading212 summary --year 2025\n  trading212 summary --from 2026-01-01 --to 2026-03-31 --json")
  .action(summaryCommand);

// Instruments
program
  .command("instruments")
  .description("List tradable instruments")
  .option("--search <query>", "Filter by ticker, name, or ISIN")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(instrumentsCommand);

program.action(() => {
  program.help();
});

program.parse();
