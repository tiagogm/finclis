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

const program = new Command();

program
  .name("wise")
  .description("Unofficial CLI for Wise (TransferWise)")
  .version("0.1.0");

// Auth
program
  .command("login")
  .description("Authenticate via browser (email + 2FA)")
  .option("--ttl <minutes>", "Session TTL in minutes (default: 60)")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out and invalidate session")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Check session and show account info")
  .action(whoamiCommand);

// Account
program
  .command("profiles")
  .description("List your personal and business profiles")
  .action(profilesCommand);

program
  .command("balances")
  .description("Show all balances (standard + savings)")
  .action(balancesCommand);

program
  .command("activities")
  .description("Browse account activities")
  .option("--month [MM-YYYY]", "Month view (current month if no value)")
  .option("--status <status>", "Filter by status (COMPLETED, IN_PROGRESS, etc.)")
  .option("--type <type>", "Filter by activity type (TRANSFER, CARD_PAYMENT, etc.)")
  .option("--size <n>", "Page size (default 10, max 100)")
  .action(activitiesCommand);

program
  .command("statements")
  .description("Get account statement for a currency")
  .requiredOption("--currency <code>", "Currency code (e.g. GBP)")
  .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
  .action(statementsCommand);

// People
program
  .command("contacts")
  .description("Browse and search Wise contacts")
  .action(contactsCommand);

program
  .command("recipients")
  .description("Browse and search saved bank recipients")
  .action(recipientsCommand);

// Money movement
program
  .command("rates <source> <target>")
  .description("Get live exchange rate (e.g. wise rates EUR GBP)")
  .action(ratesCommand);

program
  .command("transfer <id>")
  .description("Get transfer details by ID")
  .action(transferCommand);

program
  .command("transfers")
  .description("List recent transfers")
  .action(transfersCommand);

program
  .command("move")
  .description("Convert between currencies or move between balances")
  .requiredOption("--from <currency>", "Source currency")
  .requiredOption("--to <currency>", "Target currency")
  .requiredOption("--amount <amount>", "Amount to move/convert")
  .option("--source-balance <id>", "Source balance ID (for same-currency moves)")
  .option("--target-balance <id>", "Target balance ID (for same-currency moves)")
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

program.parse();
