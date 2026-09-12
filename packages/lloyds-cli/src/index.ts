#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { balanceCommand } from "./commands/balance.js";
import { transactionsCommand } from "./commands/transactions.js";
import { summaryCommand } from "./commands/summary.js";
import { statementCommand } from "./commands/statement.js";
import { setVerbose, cleanup } from "./client.js";

const program = new Command();

program
  .name("lloyds")
  .description("Unofficial CLI for Lloyds Bank UK")
  .version("0.1.0");

program.hook("preAction", (_thisCommand, actionCommand) => {
  if (actionCommand.opts().verbose) {
    setVerbose(true);
  }
});

program
  .command("login")
  .description("Authenticate via browser and save session")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out and invalidate session")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Show account info from stored session")
  .option("-v, --verbose", "Log HTTP requests to stderr")
  .option("--json", "Output raw JSON")
  .action(whoamiCommand);

program
  .command("balance")
  .description("Show current balance")
  .option("-v, --verbose", "Log HTTP requests to stderr")
  .option("--json", "Output raw JSON")
  .action(balanceCommand);

program
  .command("transactions")
  .description("List transactions for a month")
  .option("--month <MM-YYYY>", "Month to fetch (default: current month)")
  .option("--no-cache", "Bypass cache and fetch live data")
  .option("-v, --verbose", "Log HTTP requests to stderr")
  .option("--json", "Output raw JSON")
  .action(transactionsCommand);

program
  .command("summary")
  .description("Financial summary for a month")
  .option("--month <MM-YYYY>", "Month to summarise (default: current month)")
  .option("--no-cache", "Bypass cache and fetch live data")
  .option("-v, --verbose", "Log HTTP requests to stderr")
  .option("--json", "Output raw JSON")
  .action(summaryCommand);

program
  .command("statement")
  .description("Standard bank-statement-style report for a month")
  .option("--month <YYYY-MM>", "Month to report on (default: current month)")
  .option("--no-cache", "Bypass cache and fetch live data")
  .option("-v, --verbose", "Log HTTP requests to stderr")
  .option("--json", "Output raw JSON")
  .action(statementCommand);

program.action(() => {
  program.help();
});

try {
  await program.parseAsync();
} finally {
  await cleanup();
}
process.exit(0);
