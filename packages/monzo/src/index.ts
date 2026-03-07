#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { accountsCommand } from "./commands/accounts.js";
import { balanceCommand } from "./commands/balance.js";
import { potsCommand, potsDepositCommand, potsWithdrawCommand } from "./commands/pots.js";
import { transactionsCommand } from "./commands/transactions.js";
import { transactionCommand } from "./commands/transaction.js";
import { setVerbose } from "./client.js";

const program = new Command();

program
  .name("monzo")
  .description("Unofficial CLI for Monzo")
  .version("0.1.0");

program.hook("preAction", (_thisCommand, actionCommand) => {
  if (actionCommand.opts().verbose) {
    setVerbose(true);
  }
});

// Auth
program
  .command("login")
  .description("Authenticate via OAuth2")
  .option("--sync", "Sync transactions after login")
  .option("--from <date>", "Sync from date YYYY-MM-DD (with --sync)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out and revoke session")
  .action(logoutCommand);

// Account info
program
  .command("whoami")
  .description("Show authenticated user info")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(whoamiCommand);

program
  .command("accounts")
  .description("List all accounts")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(accountsCommand);

program
  .command("balance")
  .description("Show account balance")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(balanceCommand);

// Pots
const pots = program
  .command("pots")
  .description("List pots or manage pot transfers")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(potsCommand);

pots
  .command("deposit <potId> <amount>")
  .description("Deposit amount (£) into a pot")
  .option("--yes", "Skip confirmation prompt")
  .option("-v, --verbose", "Log HTTP requests")
  .action(potsDepositCommand);

pots
  .command("withdraw <potId> <amount>")
  .description("Withdraw amount (£) from a pot")
  .option("--yes", "Skip confirmation prompt")
  .option("-v, --verbose", "Log HTTP requests")
  .action(potsWithdrawCommand);

// Transactions
program
  .command("transactions")
  .description("Browse transactions")
  .option("--from <date>", "Start date YYYY-MM-DD")
  .option("--to <date>", "End date YYYY-MM-DD")
  .option("--month <MM-YYYY>", "Month view (e.g. 03-2026)")
  .option("--limit <n>", "Page size (default 20)")
  .option("--json", "Output raw JSON (auto-paginates)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(transactionsCommand);

program
  .command("transaction <id>")
  .description("Show a single transaction by ID")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(transactionCommand);

program.action(() => {
  program.help();
});

program.parse();
