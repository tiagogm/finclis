#!/usr/bin/env bun
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { balancesCommand } from "./commands/balances.js";
import { ordersCommand } from "./commands/orders.js";
import { historyCommand } from "./commands/history.js";
import { orderCommand } from "./commands/order.js";
import { fundingCommand } from "./commands/funding.js";
import { setVerbose } from "./client.js";

const program = new Command();

program
  .name("kraken")
  .description("Unofficial CLI for Kraken cryptocurrency exchange")
  .version("0.1.0");

program.hook("preAction", (_thisCommand, actionCommand) => {
  if (actionCommand.opts().verbose) {
    setVerbose(true);
  }
});

// Auth
program
  .command("login")
  .description("Save Kraken API key and secret to OS keychain")
  .action(loginCommand);

program
  .command("logout")
  .description("Remove Kraken credentials from OS keychain")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Verify credentials and show exchange status")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(whoamiCommand);

// Account
program
  .command("balances")
  .description("Show all non-zero asset balances")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(balancesCommand);

program
  .command("orders")
  .description("List open orders")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(ordersCommand);

program
  .command("history")
  .description("Show closed order history")
  .option("--pair <pair>", "Filter by trading pair (e.g. XBTUSD)")
  .option("--limit <n>", "Number of orders to show (default: 20)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(historyCommand);

// Trading
program
  .command("order")
  .description("Place a new order (interactive or via flags)")
  .option("--pair <pair>", "Trading pair (e.g. XBTUSD)")
  .option("--side <side>", "buy or sell")
  .option("--type <type>", "market or limit")
  .option("--amount <volume>", "Order volume")
  .option("--price <price>", "Limit price (required for limit orders)")
  .option("--yes", "Skip confirmation prompt")
  .option("-v, --verbose", "Log HTTP requests")
  .action(orderCommand);

// Funding
program
  .command("funding")
  .description("Show deposit and withdrawal history")
  .option("--type <type>", "Filter by type: deposit or withdrawal")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(fundingCommand);

program.action(() => {
  program.help();
});

program.parse();
