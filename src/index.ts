import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";

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

program.parse();
