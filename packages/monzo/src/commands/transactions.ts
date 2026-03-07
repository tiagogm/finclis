import fs from "node:fs";
import path from "node:path";
import { monzoGet, requireSession } from "../client.js";
import { prompt } from "../auth.js";
import { CACHE_DIR, type MonzoSession } from "../auth.js";
import { parseMonth, monthBounds, validateDate } from "../validate.js";
import { writeJson, handleJsonError } from "../json.js";
import type { BaseCommandOpts } from "../json.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

function formatAmount(amount: number, currency: string): string {
  const abs = Math.abs(amount) / 100;
  const sign = amount < 0 ? "-" : "+";
  return `${sign}${currency} ${abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function printTransactions(txs: any[]): void {
  if (txs.length === 0) {
    console.log("No transactions found.");
    return;
  }

  const rows = txs.map((t: any) => ({
    date: (t.created || "").slice(0, 10),
    amount: formatAmount(t.amount || 0, t.currency || "GBP"),
    category: t.category || "",
    description: t.description || t.merchant?.name || "",
  }));

  const w = {
    date: 10,
    amount: Math.max(6, ...rows.map((r) => r.amount.length)),
    category: Math.max(8, ...rows.map((r) => r.category.length)),
    description: Math.max(11, ...rows.map((r) => r.description.length)),
  };

  console.log(
    `${"Date".padEnd(w.date)}  ${"Amount".padEnd(w.amount)}  ${"Category".padEnd(w.category)}  Description`
  );
  console.log(
    `${"─".repeat(w.date)}  ${"─".repeat(w.amount)}  ${"─".repeat(w.category)}  ${"─".repeat(w.description)}`
  );

  for (const r of rows) {
    console.log(
      `${r.date.padEnd(w.date)}  ${r.amount.padEnd(w.amount)}  ${r.category.padEnd(w.category)}  ${r.description}`
    );
  }
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function isOldRange(since: string): boolean {
  return Date.now() - new Date(since).getTime() > NINETY_DAYS_MS;
}

function loadCache(month: number, year: number): any[] | null {
  const mm = String(month).padStart(2, "0");
  const file = path.join(CACHE_DIR, `transactions-${year}-${mm}.json`);
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchTransactions(opts: {
  accountId: string;
  since?: string;
  before?: string;
  limit?: number;
  lastId?: string;
}): Promise<any[]> {
  const params = new URLSearchParams({ account_id: opts.accountId });
  // lastId takes precedence over since for pagination (cursor-based)
  if (opts.lastId) {
    params.set("since", opts.lastId);
  } else if (opts.since) {
    params.set("since", opts.since);
  }
  if (opts.before) params.set("before", opts.before);
  if (opts.limit) params.set("limit", String(opts.limit));

  const data = await monzoGet(`/transactions?${params}`);
  return data.transactions || [];
}

interface TransactionsOpts extends BaseCommandOpts {
  from?: string;
  to?: string;
  month?: string;
  limit?: string;
  sync?: boolean;
}

export async function transactionsCommand(opts: TransactionsOpts = {}): Promise<void> {
  try {
    const session = await requireSession();

    if (opts.sync) {
      const fromDate = opts.from
        ? new Date(validateDate(opts.from))
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      await syncTransactions(session, fromDate);
      return;
    }

    if (opts.from) validateDate(opts.from);
    if (opts.to) validateDate(opts.to);

    const now = new Date();
    const nowMonth = now.getMonth() + 1;
    const nowYear = now.getFullYear();

    // JSON mode — auto-paginate all results
    if (opts.json) {
      let since: string | undefined;
      let before: string | undefined;

      if (opts.from || opts.to) {
        since = opts.from ? new Date(opts.from).toISOString() : undefined;
        before = opts.to ? new Date(opts.to + "T23:59:59.999Z").toISOString() : undefined;
      } else if (opts.month) {
        const parsed = parseMonth(opts.month);
        if (!parsed) {
          console.error(`Invalid month: "${opts.month}". Expected MM-YYYY.`);
          process.exit(1);
        }
        const bounds = monthBounds(parsed.month, parsed.year);
        since = bounds.since;
        before = bounds.before;
      }

      // Check cache for old data
      if (since && isOldRange(since) && opts.month) {
        const parsed = parseMonth(opts.month!)!;
        const cached = loadCache(parsed.month, parsed.year);
        if (!cached) {
          console.error(
            `Data older than 90 days requires a cached sync. Run: monzo transactions --sync`
          );
          process.exit(1);
        }
        writeJson(cached);
        return;
      }

      const allTxs: any[] = [];
      let lastId: string | undefined;
      const limit = opts.limit ? parseInt(opts.limit, 10) : 100;

      while (true) {
        const batch = await fetchTransactions({
          accountId: session.account_id,
          since,
          before,
          limit: 100,
          lastId,
        });
        allTxs.push(...batch);
        if (batch.length < 100) break;
        if (limit && allTxs.length >= limit) break;
        lastId = batch[batch.length - 1].id;
      }

      writeJson(allTxs);
      return;
    }

    // Interactive / human mode
    const pageSize = opts.limit ? parseInt(opts.limit, 10) : 20;
    const isMonthMode = !!opts.month;

    let currentMonth = nowMonth;
    let currentYear = nowYear;

    if (isMonthMode) {
      if (!opts.month) {
        // no-op, stays at now
      } else {
        const parsed = parseMonth(opts.month);
        if (!parsed) {
          console.error(`Invalid month: "${opts.month}". Expected MM-YYYY (e.g. 03-2026).`);
          process.exit(1);
        }
        if (parsed.year > nowYear || (parsed.year === nowYear && parsed.month > nowMonth)) {
          console.error(`Invalid month: "${opts.month}" is in the future.`);
          process.exit(1);
        }
        currentMonth = parsed.month;
        currentYear = parsed.year;
      }
    }

    let lastId: string | undefined;

    while (true) {
      let since: string | undefined;
      let before: string | undefined;

      if (isMonthMode) {
        const bounds = monthBounds(currentMonth, currentYear);
        since = bounds.since;
        before = bounds.before;

        // Use cache for old data
        if (isOldRange(since)) {
          const cached = loadCache(currentMonth, currentYear);
          if (!cached) {
            console.error(
              `Data older than 90 days requires a cached sync. Run: monzo transactions --sync`
            );
            process.exit(1);
          }
          console.log(`\nTransactions (${cached.length}) — ${monthLabel(currentMonth, currentYear)} [cached]\n`);
          printTransactions(cached);
        } else {
          const txs = await fetchTransactions({
            accountId: session.account_id,
            since,
            before,
            limit: pageSize,
            lastId,
          });
          console.log(`\nTransactions (${txs.length}) — ${monthLabel(currentMonth, currentYear)}\n`);
          printTransactions(txs);
          lastId = txs.length > 0 && txs.length >= pageSize ? txs[txs.length - 1].id : undefined;
        }
      } else if (opts.from || opts.to) {
        since = opts.from ? new Date(opts.from).toISOString() : undefined;
        before = opts.to ? new Date(opts.to + "T23:59:59.999Z").toISOString() : undefined;
        const txs = await fetchTransactions({
          accountId: session.account_id,
          since,
          before,
          limit: pageSize,
          lastId,
        });
        console.log(`\nTransactions (${txs.length})\n`);
        printTransactions(txs);
        lastId = txs.length > 0 && txs.length >= pageSize ? txs[txs.length - 1].id : undefined;
      } else {
        // default: last N transactions
        const txs = await fetchTransactions({
          accountId: session.account_id,
          limit: pageSize,
          lastId,
        });
        console.log(`\nTransactions (${txs.length})\n`);
        printTransactions(txs);
        lastId = txs.length > 0 && txs.length >= pageSize ? txs[txs.length - 1].id : undefined;
      }

      // Navigation
      const nav: string[] = [];
      if (lastId) nav.push("[n]ext page");
      if (isMonthMode) {
        nav.push("[p]rev month");
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
        const canForward = nextYear < nowYear || (nextYear === nowYear && nextMonth <= nowMonth);
        if (canForward) nav.push("[f]orward month");
      }
      nav.push("[q]uit");

      if (nav.length === 1) break;

      let input: string;
      while (true) {
        input = (await prompt(`\n${nav.join("  ")}  `)).trim().toLowerCase();
        const nextMonth2 = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextYear2 = currentMonth === 12 ? currentYear + 1 : currentYear;
        const canForward2 = isMonthMode &&
          (nextYear2 < nowYear || (nextYear2 === nowYear && nextMonth2 <= nowMonth));
        if (
          (input === "n" && lastId) ||
          (input === "p" && isMonthMode) ||
          (input === "f" && canForward2) ||
          input === "q" ||
          input === ""
        ) break;
      }

      if (input === "n" && lastId) {
        // continue
      } else if (input === "p" && isMonthMode) {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        lastId = undefined;
      } else if (input === "f" && isMonthMode) {
        currentMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        if (currentMonth === 1) currentYear++;
        lastId = undefined;
      } else {
        break;
      }
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function syncTransactions(session: MonzoSession, fromDate: Date): Promise<void> {
  console.log("Monzo requires Strong Customer Authentication (SCA) to access transactions older than 90 days. Run this within 5 minutes of `monzo login` to avoid 403 errors.\n");
  fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });

  const now = new Date();
  const current = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));

  while (current <= now) {
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth() + 1;
    const since = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const before = new Date(Date.UTC(year, month, 1)).toISOString();

    const mm = String(month).padStart(2, "0");
    const label = `${year}-${mm}`;

    const transactions: any[] = [];
    let lastId: string | null = null;
    let failed = false;

    while (true) {
      try {
        const batch = await fetchTransactions({
          accountId: session.account_id,
          since: lastId || since,
          before,
          limit: 100,
          lastId: lastId || undefined,
        });
        transactions.push(...batch);
        if (batch.length < 100) break;
        lastId = batch[batch.length - 1].id;
      } catch (err: any) {
        const is403 = err.message?.includes("403");
        console.error(`Failed to sync ${label}: ${err.message}`);
        failed = true;
        break;
      }
    }

    if (!failed) {
      const cacheFile = path.join(CACHE_DIR, `transactions-${label}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(transactions, null, 2), { mode: 0o600 });
      console.log(`Synced ${label}: ${transactions.length} transactions`);
    }

    current.setUTCMonth(current.getUTCMonth() + 1);
  }
}
