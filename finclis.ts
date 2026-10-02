import { spawnSync } from "node:child_process";
import { join } from "node:path";

const vendors = [
  { name: "kraken", dir: "kraken", description: "Kraken cryptocurrency exchange" },
  { name: "lloyds", dir: "lloyds-cli", description: "Lloyds Bank UK" },
  { name: "monzo", dir: "monzo", description: "Monzo" },
  { name: "trading212", dir: "trading212", description: "Trading212" },
  { name: "vanguard", dir: "vanguard", description: "Vanguard Investor UK" },
  { name: "wise", dir: "wise", description: "Wise (TransferWise)" },
];

const rootDir = import.meta.dir;

function help(): void {
  const vendorList = vendors
    .map((v) => `  ${v.name.padEnd(13)}${v.description}`)
    .join("\n");
  console.log(`finclis - unofficial CLIs for financial platforms

Usage:
  finclis <vendor> [command] [options]
  finclis help <vendor>

Vendors:
${vendorList}

Examples:
  finclis monzo --help              List monzo commands
  finclis monzo statement           Run a monzo command
  finclis help kraken               Show kraken help
`);
}

function run(name: string, args: string[]): number {
  const vendor = vendors.find((v) => v.name === name);
  if (!vendor) {
    console.error(`Unknown vendor: ${name}\n`);
    help();
    return 1;
  }
  const bin = join(rootDir, "packages", vendor.dir, vendor.name);
  const result = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

const [first, ...rest] = process.argv.slice(2);

if (!first || first === "-h" || first === "--help" || (first === "help" && !rest.length)) {
  help();
  process.exit(0);
}

if (first === "help") {
  process.exit(run(rest[0]!, ["--help"]));
}

process.exit(run(first, rest));
