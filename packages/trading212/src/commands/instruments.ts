import { t212Get } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import readline from "node:readline";

const PAGE_SIZE = 20;

interface InstrumentsOpts extends BaseCommandOpts {
  search?: string;
}

function formatRow(i: any): string {
  return `${String(i.ticker).padEnd(16)} ${String(i.isin ?? "-").padEnd(14)} ${String(i.type ?? "-").padEnd(10)} ${String(i.name ?? "-").slice(0, 35)}`;
}

async function promptContinue(shown: number, total: number): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`-- ${shown}/${total} -- Press Enter for more, q to quit: `, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() !== "q");
    });
  });
}

export async function instrumentsCommand(opts: InstrumentsOpts = {}): Promise<void> {
  try {
    const instruments = await t212Get("/equity/metadata/instruments");

    if (opts.json) {
      writeJson(instruments);
      return;
    }

    let list = instruments as any[];
    if (opts.search) {
      const q = opts.search.toLowerCase();
      list = list.filter(
        (i: any) =>
          String(i.ticker).toLowerCase().includes(q) ||
          String(i.name ?? "").toLowerCase().includes(q) ||
          String(i.isin ?? "").toLowerCase().includes(q)
      );
    }

    if (!list.length) {
      console.log("No instruments found.");
      return;
    }

    const header = `${"Ticker".padEnd(16)} ${"ISIN".padEnd(14)} ${"Type".padEnd(10)} Name`;
    const divider = "-".repeat(80);
    console.log(header);
    console.log(divider);

    for (let offset = 0; offset < list.length; offset += PAGE_SIZE) {
      const page = list.slice(offset, offset + PAGE_SIZE);
      for (const i of page) {
        console.log(formatRow(i));
      }

      const shown = Math.min(offset + PAGE_SIZE, list.length);
      if (shown >= list.length) {
        console.log(`\n${list.length} instrument(s)`);
        break;
      }

      const cont = await promptContinue(shown, list.length);
      if (!cont) break;

      // Reprint header after each page for readability
      console.log(header);
      console.log(divider);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
