import { Command } from "commander";

const program = new Command();

program
  .name("wise")
  .description("CLI to access Wise financial data")
  .version("0.1.0");

program.parse();
