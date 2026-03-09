#!/usr/bin/env bun
import { Command } from "commander";
import { authViewCommand, authSetCommand, authClearCommand } from "./commands/auth.js";
import { whoamiCommand } from "./commands/whoami.js";
import { balancesCommand } from "./commands/balances.js";
import { ordersCommand, cancelCommand, queryCommand } from "./commands/orders.js";
import { tickerCommand } from "./commands/ticker.js";
import { historyCommand } from "./commands/history.js";
import { orderCommand } from "./commands/order.js";
import { fundingCommand } from "./commands/funding.js";
import { setVerbose, setOtp } from "./client.js";

const program = new Command();

program
  .name("kraken")
  .description("Unofficial CLI for Kraken cryptocurrency exchange")
  .version("0.1.0")
  .option("--otp <code>", "2FA one-time password");

program.hook("preAction", (_thisCommand, actionCommand) => {
  const opts = program.opts();
  if (actionCommand.opts().verbose) setVerbose(true);
  if (opts.otp) setOtp(opts.otp);
});

// Auth
const auth = program
  .command("auth")
  .description("Manage Kraken API credentials")
  .addHelpText("after", "\nGet your API keys at:\n  https://www.kraken.com/u/security/api")
  .action(function(this: any) {
    console.log("Commands:");
    for (const cmd of this.commands) {
      console.log(`  kraken auth ${cmd.name().padEnd(8)} ${cmd.description()}`);
    }
  });

auth.command("set").description("Save API key and secret").action(authSetCommand);
auth.command("view").description("Show stored credentials").action(authViewCommand);
auth.command("clear").description("Remove stored credentials").action(authClearCommand);

program
  .command("whoami")
  .description("Verify credentials and show exchange status")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(whoamiCommand);

program
  .command("ticker")
  .argument("<asset>", "Asset or pair: BTC, ETH, XBTUSD, BTC/USD")
  .description("Show current price and 24h stats (no auth required)")
  .option("--quote <currency>", "Quote currency when only base is given (default: USD)", "USD")
  .option("--json", "Output raw JSON")
  .addHelpText("after", "\nExamples:\n  kraken ticker BTC\n  kraken ticker ETH --quote EUR\n  kraken ticker XBTUSD\n  kraken ticker BTC --json")
  .action(tickerCommand);

// Account
program
  .command("balances")
  .description("Show all non-zero asset balances")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .option("--rates <code>", "Show price and estimated value in this currency (e.g. USD, GBP, EUR)")
  .action(balancesCommand);

// Orders group
const orders = program
  .command("orders")
  .description("Manage orders")
  .action(function(this: any) {
    console.log("Commands:");
    for (const cmd of this.commands) {
      console.log(`  kraken orders ${cmd.name().padEnd(10)} ${cmd.description()}`);
    }
  });

orders
  .command("open")
  .description("List open orders")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(ordersCommand);

orders
  .command("history")
  .description("Show closed order history with interactive pagination")
  .option("--pair <pair>", "Filter by trading pair (e.g. XBTUSD)")
  .option("--limit <n>", "Entries per page (default: 20)")
  .option("--month [month]", "Filter by month: YYYY-MM (e.g. 2026-01), or --month for current month")
  .option("--offset <n>", "Skip N results (default: 0)")
  .option("--start <timestamp>", "Start time (Unix timestamp)")
  .option("--end <timestamp>", "End time (Unix timestamp)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .addHelpText("after", "\nExamples:\n  kraken orders history\n  kraken orders history --month              # current month, interactive\n  kraken orders history --month 2026-01     # January 2026\n  kraken orders history --pair XBTUSD --limit 50")
  .action(historyCommand);

orders
  .command("cancel [txid]")
  .description("Cancel an open order by transaction ID, or all orders with --all")
  .option("--all", "Cancel all open orders")
  .option("--yes", "Skip confirmation prompt")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .addHelpText("after", "\nExamples:\n  kraken orders cancel OABCD-11111-AAAAA\n  kraken orders cancel --all\n  kraken orders cancel --all --yes")
  .action(cancelCommand);

orders
  .command("query [txid...]")
  .description("Look up orders by transaction ID, or list all open orders")
  .option("--open", "List all open/pending orders (cancellable)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(queryCommand);

orders
  .command("place")
  .description("Place a new order (interactive or via flags)")
  .option("--pair <pair>", "Trading pair (e.g. XBTUSD)")
  .option("--side <side>", "buy or sell")
  .option("--type <type>", "market or limit")
  .option("--amount <volume>", "Order volume")
  .option("--price <price>", "Limit price (required for limit orders)")
  .option("--yes", "Skip confirmation prompt")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  kraken orders place --pair XBTUSD --side buy --type market --amount 0.001 --yes\n  kraken orders place   # interactive")
  .action(orderCommand);

// Funding group
const funding = program
  .command("funding")
  .description("Funding activity (deposits, withdrawals)")
  .action(function(this: any) {
    console.log("Commands:");
    for (const cmd of this.commands) {
      console.log(`  kraken funding ${cmd.name().padEnd(10)} ${cmd.description()}`);
    }
  });

funding
  .command("history")
  .description("Show ledger entries (deposits, withdrawals) with interactive pagination")
  .option("--type <type>", "Filter by type: deposit, withdrawal, trade, ...")
  .option("--asset <asset>", "Filter by asset (e.g. XXBT)")
  .option("--limit <n>", "Entries per page (default: 20)")
  .option("--month [month]", "Filter by month: YYYY-MM (e.g. 2026-01), or --month for current month")
  .option("--offset <n>", "Skip N results (default: 0)")
  .option("--start <timestamp>", "Start time (Unix timestamp)")
  .option("--end <timestamp>", "End time (Unix timestamp)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .addHelpText("after", "\nExamples:\n  kraken funding history\n  kraken funding history --month              # current month, interactive\n  kraken funding history --month 2026-02     # February 2026\n  kraken funding history --type deposit\n  kraken funding history --asset XXBT")
  .action(fundingCommand);

program.action(() => {
  program.help();
});

program.parse();
