#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { accountsListCommand, accountsSetCommand } from "./commands/accounts.js";
import { balanceCommand } from "./commands/balance.js";
import { potsCommand, potsDepositCommand, potsWithdrawCommand } from "./commands/pots.js";
import { transactionsCommand } from "./commands/transactions.js";
import { summaryCommand } from "./commands/summary.js";
import { authViewCommand, authSetCommand, authClearCommand } from "./commands/auth.js";
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

// Credentials
const auth = program
  .command("auth")
  .description("Manage Monzo API credentials")
  .addHelpText("after", "\nGet your client_id and client_secret at:\n  https://docs.monzo.com/#authentication")
  .action(function(this: Command) {
    this.help();
  });

auth.command("view").description("Show stored credentials").action(authViewCommand);
auth.command("set").description("Set client_id and client_secret").action(authSetCommand);
auth.command("clear").description("Remove stored credentials").action(authClearCommand);

// Auth
program
  .command("login")
  .description("Authenticate via OAuth2")
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

const accounts = program
  .command("accounts")
  .description("Manage Monzo accounts")
  .action(function(this: Command) {
    this.help();
  });

accounts
  .command("list")
  .description("List all accounts")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .action(accountsListCommand);

accounts
  .command("set [accountId]")
  .description("Switch active account (interactive, or pass account ID)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(accountsSetCommand);

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
  .option("--from <DD-MM-YYYY>", "Start date")
  .option("--to <DD-MM-YYYY>", "End date")
  .option("--month <MM-YYYY>", "Month view (e.g. 03-2026)")
  .option("--limit <n>", "Page size (default 20)")
  .option("--cache", "Cache transactions locally (use --from to set start date)")
  .option("--json", "Output raw JSON (auto-paginates)")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  monzo transactions\n  monzo transactions --month 03-2026\n  monzo transactions --from 01-01-2026 --to 31-01-2026\n  monzo transactions --json | jq '.[] | .description'\n  monzo transactions --cache --from 01-01-2025")
  .action(transactionsCommand);

program
  .command("summary")
  .description("Monthly spending breakdown by category")
  .option("--month <MM-YYYY>", "Month to summarise (default: current)")
  .option("--json", "Output raw JSON")
  .option("-v, --verbose", "Log HTTP requests")
  .addHelpText("after", "\nExamples:\n  monzo summary\n  monzo summary --month 03-2026\n  monzo summary --json")
  .action(summaryCommand);

program.action(() => {
  program.help();
});

program.parse();
