#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { cashCommand } from "./commands/cash.js";
import { positionsCommand } from "./commands/positions.js";
import { ordersCommand } from "./commands/orders.js";
import { registerHistoryCommand } from "./commands/history.js";
import { instrumentsCommand } from "./commands/instruments.js";
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
program
  .command("login")
  .description("Authenticate with your Trading212 API key")
  .option("-v, --verbose", "Log HTTP requests")
  .action(loginCommand);

program
  .command("logout")
  .description("Remove stored credentials")
  .action(logoutCommand);

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
