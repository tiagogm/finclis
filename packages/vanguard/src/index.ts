#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { balanceCommand } from "./commands/balance.js";
import { holdingsCommand } from "./commands/holdings.js";
import { performanceCommand } from "./commands/performance.js";
import { summaryCommand } from "./commands/summary.js";
import { setVerbose } from "./client.js";

const program = new Command();

program
  .name("vanguard")
  .description("Unofficial CLI for Vanguard Investor UK")
  .version("0.1.0");

program.hook("preAction", (_thisCommand, actionCommand) => {
  if (actionCommand.opts().verbose) {
    setVerbose(true);
  }
});

// Auth
program
  .command("login")
  .description("Authenticate via browser (email + 2FA)")
  .option("--ttl <minutes>", "Session TTL in minutes (default: 60)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out and clear session")
  .option("-v, --verbose", "Log HTTP requests")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Check session and show account info")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(whoamiCommand);

// Portfolio
program
  .command("balance")
  .description("Show total, invested, and cash balances")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(balanceCommand);

program
  .command("holdings")
  .description("Show portfolio holdings breakdown")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(holdingsCommand);

program
  .command("performance")
  .description("Show lifetime performance (cumulative return)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(performanceCommand);

program
  .command("summary")
  .description(
    "Monthly investment summary\n" +
    "  --month MM-YYYY   Specific month (default: current)\n" +
    "  --year YYYY       Full year summary table\n" +
    "  --from/--to DATE  Custom date range (YYYY-MM-DD)"
  )
  .option("--month <MM-YYYY>", "Specific month (default: current month)")
  .option("--year <YYYY>", "Full year summary table")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--json", "Output raw JSON")
  .action(summaryCommand);

program.action(() => {
  program.help();
});

program.parse();
