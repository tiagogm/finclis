import { requireSession } from "../client.js";
import { parseMonth, monthBounds } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";
import {
  monthLabel,
  formatAmount,
  isOldRange,
  loadCache,
  fetchTransactions,
} from "./transactions.js";

interface SummaryOpts extends BaseCommandOpts {
  month?: string;
}

interface CategoryRow {
  name: string;
  amount: number;
  count: number;
}

export async function summaryCommand(opts: SummaryOpts = {}): Promise<void> {
  try {
    const session = await requireSession();

    const now = new Date();
    let month = now.getMonth() + 1;
    let year = now.getFullYear();

    if (opts.month) {
      const parsed = parseMonth(opts.month);
      if (!parsed) {
        console.error(`Invalid month: "${opts.month}". Expected YYYY-MM.`);
        process.exit(0);
      }
      if (parsed.year > year || (parsed.year === year && parsed.month > month)) {
        console.error(`Invalid month: "${opts.month}" is in the future.`);
        process.exit(0);
      }
      month = parsed.month;
      year = parsed.year;
    }

    const bounds = monthBounds(month, year);
    let txs: any[];

    if (isOldRange(bounds.since)) {
      const cached = loadCache(month, year);
      if (!cached) {
        console.error(
          `Data older than 90 days requires a cached sync. Run: monzo transactions --cache`
        );
        process.exit(0);
      }
      txs = cached;
    } else {
      txs = [];
      let lastId: string | undefined;
      while (true) {
        const batch = await fetchTransactions({
          accountId: session.account_id,
          since: bounds.since,
          before: bounds.before,
          limit: 100,
          lastId,
        });
        txs.push(...batch);
        if (batch.length < 100) break;
        lastId = batch[batch.length - 1].id;
      }
    }

    // Aggregate by category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    let totalIn = 0;
    let totalInCount = 0;
    let totalOut = 0;
    let totalOutCount = 0;
    const currency = txs[0]?.currency || "GBP";

    for (const tx of txs) {
      const amt = tx.amount || 0;
      if (amt === 0) continue;

      if (amt > 0) {
        totalIn += amt;
        totalInCount++;
      } else {
        totalOut += amt;
        totalOutCount++;
        const cat = tx.category || "general";
        const entry = categoryMap.get(cat);
        if (entry) {
          entry.amount += amt;
          entry.count++;
        } else {
          categoryMap.set(cat, { amount: amt, count: 1 });
        }
      }
    }

    const categories: CategoryRow[] = Array.from(categoryMap.entries())
      .map(([name, { amount, count }]) => ({ name, amount, count }))
      .sort((a, b) => a.amount - b.amount); // most negative first

    const net = totalIn + totalOut;

    if (opts.json) {
      writeJson({
        month: `${String(month).padStart(2, "0")}-${year}`,
        currency,
        categories: categories.map((c) => ({
          name: c.name,
          amount: c.amount,
          count: c.count,
        })),
        totalIn,
        totalOut,
        net,
      });
      return;
    }

    // Print table
    console.log(`\n${monthLabel(month, year)}\n`);

    if (categories.length === 0 && totalInCount === 0) {
      console.log("No transactions found.");
      return;
    }

    const rows = categories.map((c) => ({
      category: c.name,
      spent: formatAmount(c.amount, currency),
      txns: String(c.count),
    }));

    const w = {
      category: Math.max(8, ...rows.map((r) => r.category.length)),
      spent: Math.max(5, ...rows.map((r) => r.spent.length)),
      txns: Math.max(4, ...rows.map((r) => r.txns.length)),
    };

    const totalOutStr = formatAmount(totalOut, currency);
    const totalInStr = formatAmount(totalIn, currency);
    const netStr = formatAmount(net, currency);
    w.spent = Math.max(w.spent, totalOutStr.length, totalInStr.length, netStr.length);

    console.log(
      `${"Category".padEnd(w.category)}  ${"Spent".padStart(w.spent)}  ${"Txns".padStart(w.txns)}`
    );
    console.log(
      `${"─".repeat(w.category)}  ${"─".repeat(w.spent)}  ${"─".repeat(w.txns)}`
    );
    for (const r of rows) {
      console.log(
        `${r.category.padEnd(w.category)}  ${r.spent.padStart(w.spent)}  ${r.txns.padStart(w.txns)}`
      );
    }
    console.log(
      `${"─".repeat(w.category)}  ${"─".repeat(w.spent)}  ${"─".repeat(w.txns)}`
    );
    console.log(
      `${"Total out".padEnd(w.category)}  ${totalOutStr.padStart(w.spent)}  ${String(totalOutCount).padStart(w.txns)}`
    );
    console.log(
      `${"Total in".padEnd(w.category)}  ${totalInStr.padStart(w.spent)}  ${String(totalInCount).padStart(w.txns)}`
    );
    console.log(
      `${"Net".padEnd(w.category)}  ${netStr.padStart(w.spent)}`
    );
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
