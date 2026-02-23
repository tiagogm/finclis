import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { profilesCommand } from "./commands/profiles.js";
import { balancesCommand } from "./commands/balances.js";
import { ratesCommand } from "./commands/rates.js";
import { statementsCommand } from "./commands/statements.js";
import { transfersCommand } from "./commands/transfers.js";

const program = new Command();

program
  .name("wise")
  .description("CLI to access Wise financial data")
  .version("0.1.0");

program
  .command("login")
  .description("Login to Wise with email + password")
  .action(loginCommand);

program
  .command("logout")
  .description("Clear saved session")
  .action(logoutCommand);

program
  .command("profiles")
  .description("List all profiles")
  .action(profilesCommand);

program
  .command("balances")
  .description("Show balances for your profile")
  .action(balancesCommand);

program
  .command("rates <source> <target>")
  .description("Get exchange rate (e.g. wise rates EUR GBP)")
  .action(ratesCommand);

program
  .command("statements")
  .description("Get balance statement for a currency")
  .requiredOption("--currency <code>", "Currency code (e.g. GBP)")
  .requiredOption("--from <date>", "Start date (YYYY-MM-DD)")
  .requiredOption("--to <date>", "End date (YYYY-MM-DD)")
  .action(statementsCommand);

program
  .command("transfers")
  .description("List recent transfers")
  .action(transfersCommand);

program.parse();
