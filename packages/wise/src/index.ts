#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { profilesCommand } from "./commands/profiles.js";
import { balancesCommand } from "./commands/balances.js";
import { ratesCommand } from "./commands/rates.js";
import { statementsCommand } from "./commands/statements.js";
import { transferCommand } from "./commands/transfer.js";
import { transfersCommand } from "./commands/transfers.js";
import { contactsCommand } from "./commands/contacts.js";
import { recipientsCommand } from "./commands/recipients.js";
import { moveCommand } from "./commands/move.js";
import { sendCommand } from "./commands/send.js";
import { whoamiCommand } from "./commands/whoami.js";
import { activitiesCommand } from "./commands/activities.js";
import { setVerbose } from "./client.js";
import { setScaVerbose } from "./sca.js";

const program = new Command();

program
  .name("wise")
  .description("Unofficial CLI for Wise (TransferWise)")
  .version("0.1.0");

program.hook("preAction", (_thisCommand, actionCommand) => {
  if (actionCommand.opts().verbose) {
    setVerbose(true);
    setScaVerbose(true);
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
  .description("Log out and invalidate session")
  .option("-v, --verbose", "Log HTTP requests")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Check session and show account info")
  .option("-v, --verbose", "Log HTTP requests")
  .action(whoamiCommand);

// Account
program
  .command("profiles")
  .description("List your personal and business profiles")
  .option("-v, --verbose", "Log HTTP requests")
  .action(profilesCommand);

program
  .command("balances")
  .description("Show all balances (standard + savings)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(balancesCommand);

program
  .command("activities")
  .description("Browse account activities")
  .option("--month [MM-YYYY]", "Month view (current month if no value)")
  .option("--status <status>", "Filter by status (COMPLETED, IN_PROGRESS, etc.)")
  .option("--type <type>", "Filter by activity type (TRANSFER, CARD_PAYMENT, etc.)")
  .option("--size <n>", "Page size (default 10, max 100)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(activitiesCommand);

program
  .command("statements")
  .description("Get account statement for a currency")
  .requiredOption("--currency <code>", "Currency code (e.g. GBP)")
  .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(statementsCommand);

// People
program
  .command("contacts")
  .description("Browse and search Wise contacts")
  .option("-v, --verbose", "Log HTTP requests")
  .action(contactsCommand);

program
  .command("recipients")
  .description("Browse and search saved bank recipients")
  .option("-v, --verbose", "Log HTTP requests")
  .action(recipientsCommand);

// Money movement
program
  .command("rates <source> <target>")
  .description("Get live exchange rate (e.g. wise rates EUR GBP)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(ratesCommand);

program
  .command("transfer <id>")
  .description("Get transfer details by ID")
  .option("-v, --verbose", "Log HTTP requests")
  .action(transferCommand);

program
  .command("transfers")
  .description("List recent transfers")
  .option("-v, --verbose", "Log HTTP requests")
  .action(transfersCommand);

program
  .command("move")
  .description("Convert between currencies or move between balances")
  .requiredOption("--from <currency>", "Source currency")
  .requiredOption("--to <currency>", "Target currency")
  .requiredOption("--amount <amount>", "Amount to move/convert")
  .option("--source-balance <id>", "Source balance ID (for same-currency moves)")
  .option("--target-balance <id>", "Target balance ID (for same-currency moves)")
  .option("-v, --verbose", "Log HTTP requests")
  .action(moveCommand);

program
  .command("send <amount> <currency>")
  .description("Send money to a recipient (quote → transfer → fund)")
  .option("--to <recipientId>", "Recipient account ID (skips interactive picker)")
  .option("--from <balanceId>", "Source balance ID")
  .option("--target-currency <code>", "Target currency (defaults to recipient's currency)")
  .option("--reference <text>", "Payment reference text")
  .option("-v, --verbose", "Log HTTP requests")
  .option("--yes", "Skip confirmation prompt")
  .action(sendCommand);

program.action(() => {
  program.help();
});

program.parse();
