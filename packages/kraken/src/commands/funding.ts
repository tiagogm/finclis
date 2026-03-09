import { krakenPrivatePost } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import { parseMonth, monthBounds } from "../validate.js";

interface FundingOpts extends BaseCommandOpts {
  type?: string;
  asset?: string;
  limit?: string;
  month?: string | true;
  offset?: string;
  start?: string;
  end?: string;
}

const GAP = 2;
function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) return;
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => r[i].length)) + GAP
  );
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("").trimEnd();
  console.log(fmt(headers));
  console.log(fmt(headers.map(h => "—".repeat(h.length))));
  for (const row of rows) console.log(fmt(row));
}

async function readKey(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(data.toString());
    });
  });
}

export async function fundingCommand(opts: FundingOpts = {}): Promise<void> {
  try {
    const limit = parseInt(opts.limit || "20", 10);
    const isTTY = process.stdout.isTTY;
    const interactive = isTTY && !opts.json;
    const clientFilter = !opts.type;

    let monthMode = false;
    let curMonth: number | undefined;
    let curYear: number | undefined;

    if (opts.month !== undefined && !opts.start && !opts.end) {
      monthMode = true;
      if (opts.month === true) {
        const now = new Date();
        curMonth = now.getUTCMonth() + 1;
        curYear = now.getUTCFullYear();
      } else {
        const parsed = parseMonth(opts.month);
        if (!parsed) {
          console.error(`Invalid month format: "${opts.month}". Use YYYY-MM or YYYY-M (e.g. 2026-01).`);
          process.exit(1);
        }
        curMonth = parsed.month;
        curYear = parsed.year;
      }
    }

    let currentOffset = parseInt(opts.offset || "0", 10);

    const fetchPage = async () => {
      const params: Record<string, string> = {};
      if (opts.type) params.type = opts.type;
      if (opts.asset) params.asset = opts.asset;
      params.ofs = String(currentOffset);

      if (monthMode && curMonth !== undefined && curYear !== undefined) {
        const { start, end } = monthBounds(curMonth, curYear);
        params.start = String(start);
        params.end = String(end);
      } else {
        if (opts.start) params.start = opts.start;
        if (opts.end) params.end = opts.end;
      }

      const result = await krakenPrivatePost("/0/private/Ledgers", params);
      const allEntries = Object.entries(result.ledger as Record<string, any>);
      const total = result.count as number;
      const filtered = clientFilter
        ? allEntries.filter(([, e]) => ["deposit", "withdrawal"].includes(e.type))
        : allEntries;
      const entries = filtered.slice(0, limit);
      return { entries, total };
    };

    const displayPage = (entries: [string, any][], total: number) => {
      if (monthMode && curMonth !== undefined && curYear !== undefined) {
        const { label } = monthBounds(curMonth, curYear);
        console.log(`\n${label}`);
      }

      if (entries.length === 0) {
        console.log("No funding entries found.");
        return;
      }

      const headers = ["Date", "Type", "Asset", "Amount", "Fee", "ID"];
      const rows = entries.map(([id, entry]) => {
        const date = new Date(entry.time * 1000).toISOString().slice(0, 10);
        return [date, entry.type, entry.asset, entry.amount, entry.fee, id];
      });
      printTable(headers, rows);

      if (clientFilter) {
        const noun = entries.length === 1 ? "entry" : "entries";
        console.log(`\nShowing ${entries.length} ${noun}.`);
      }
    };

    if (opts.json) {
      const { entries } = await fetchPage();
      writeJson(Object.fromEntries(entries));
      return;
    }

    let { entries, total } = await fetchPage();
    displayPage(entries, total);

    if (!interactive) return;

    while (true) {
      // Note: when clientFilter is true, hasNext may be a false negative — the API's
      // `count` reflects all ledger types, and client-side filtering may yield fewer
      // than `limit` entries even when more API pages exist. Use --type to avoid this.
      const hasNext = entries.length === limit && currentOffset + entries.length < total;

      // Don't show pagination UI if there's nothing to paginate
      if (!hasNext) break;

      const prompt = monthMode
        ? "[n]ext page  [p]rev month  [f]orward month  [q]uit"
        : "[n]ext page  [q]uit";
      process.stdout.write(`\n${prompt} `);

      const key = await readKey();
      process.stdout.write("\n");

      if (key === "q" || key === "\x03") {
        break;
      } else if (key === "n" && hasNext) {
        currentOffset += entries.length;
        ({ entries, total } = await fetchPage());
        displayPage(entries, total);
      } else if (key === "p" && monthMode && curMonth !== undefined && curYear !== undefined) {
        curMonth--;
        if (curMonth < 1) { curMonth = 12; curYear--; }
        currentOffset = 0;
        ({ entries, total } = await fetchPage());
        displayPage(entries, total);
      } else if (key === "f" && monthMode && curMonth !== undefined && curYear !== undefined) {
        curMonth++;
        if (curMonth > 12) { curMonth = 1; curYear++; }
        currentOffset = 0;
        ({ entries, total } = await fetchPage());
        displayPage(entries, total);
      }
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
