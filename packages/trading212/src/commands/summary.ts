import { t212Get, t212Post, t212Download } from "../client.js";
import { getCachedReportId, setCachedReportId, isPastPeriod } from "../cache.js";
import {
  validateDate,
  parseMonth,
  parseYear,
  monthBounds,
  yearBounds,
  formatAmount,
} from "../validate.js";
import { parseTransactionsCSV, type CSVTx } from "../csv.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface SummaryOpts extends BaseCommandOpts {
  month?: string;
  year?: string;
  from?: string;
  to?: string;
}

interface Trading212Report {
  reportId: number;
  status: "Queued" | "Processing" | "Running" | "Canceled" | "Failed" | "Finished";
  downloadLink?: string;
  timeFrom: string;
  timeTo: string;
}

interface MonthSummary {
  label: string;
  deposits: number;
  withdrawals: number;
  interest: number;
  dividends: number;
  netIn: number;
}

function monthKey(dateStr: string): string {
  // dateStr from CSV: "2026-03-15 10:30:00" or ISO
  const d = new Date(dateStr.replace(" ", "T") + (dateStr.includes("Z") ? "" : "Z"));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1));
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function isCurrentMonth(fromDate: string, toDate: string): boolean {
  const now = new Date();
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return from <= currentStart && currentStart <= to;
}

async function fetchCSV(fromDate: string, toDate: string): Promise<string> {
  const INITIAL_WAIT_MS = 5_000;
  const POLL_INTERVAL_MS = 10_000;
  const MAX_ATTEMPTS = 30;

  // Check cached reportId first (only for past periods — current month data changes)
  const cachedId = isPastPeriod(toDate) ? getCachedReportId(fromDate, toDate) : null;
  if (cachedId !== null) {
    const reports: Trading212Report[] = await t212Get("/equity/history/exports");
    const cached = reports.find((r) => r.reportId === cachedId && r.status === "Finished" && r.downloadLink);
    if (cached?.downloadLink) {
      process.stderr.write(`Using cached report ${cachedId}...\n`);
      return t212Download(cached.downloadLink);
    }
    // Report gone or failed — fall through to request a new one
  }

  // Request new export
  const { reportId } = await t212Post("/equity/history/exports", {
    timeFrom: fromDate,
    timeTo: toDate,
    dataIncluded: {
      includeOrders: false,
      includeDividends: true,
      includeTransactions: true,
      includeInterest: true,
    },
  });

  if (isPastPeriod(toDate)) setCachedReportId(fromDate, toDate, reportId);

  process.stderr.write(`Requesting report ${reportId}... `);
  await new Promise((r) => setTimeout(r, INITIAL_WAIT_MS));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const polls: Trading212Report[] = await t212Get("/equity/history/exports");
    const report = polls.find((r) => r.reportId === reportId);

    if (!report) {
      process.stderr.write("\n");
      throw new Error(`Report ${reportId} not found in exports list`);
    }

    process.stderr.write(`\rRequesting report ${reportId}... ${report.status.toLowerCase()}   `);

    if (report.status === "Finished" && report.downloadLink) {
      process.stderr.write("\n");
      return t212Download(report.downloadLink);
    }

    if (report.status === "Failed" || report.status === "Canceled") {
      process.stderr.write("\n");
      throw new Error(`Report ${report.status.toLowerCase()}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  process.stderr.write("\n");
  throw new Error("Timed out waiting for CSV report (5 min)");
}

function aggregateByMonth(
  txns: CSVTx[],
  fromDate: string,
  toDate: string
): MonthSummary[] {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  const map = new Map<string, MonthSummary>();

  for (const tx of txns) {
    const d = new Date(tx.date.replace(" ", "T") + (tx.date.includes("Z") ? "" : "Z"));
    if (d < from || d > to) continue;

    const key = monthKey(tx.date);
    if (!map.has(key)) {
      map.set(key, {
        label: monthLabel(key),
        deposits: 0,
        withdrawals: 0,
        interest: 0,
        dividends: 0,
        netIn: 0,
      });
    }

    const s = map.get(key)!;
    if (tx.type === "deposit") s.deposits += tx.amount;
    else if (tx.type === "withdrawal") s.withdrawals += Math.abs(tx.amount);
    else if (tx.type === "interest") s.interest += tx.amount;
    else if (tx.type === "dividend") s.dividends += tx.amount;
  }

  // Compute netIn and sort by month key
  for (const s of map.values()) {
    s.netIn = s.deposits - s.withdrawals + s.interest + s.dividends;
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export async function summaryCommand(opts: SummaryOpts): Promise<void> {
  try {
    const flagCount = [opts.month, opts.year, opts.from || opts.to].filter(Boolean).length;
    if (flagCount > 1) {
      console.error("Options --month, --year, and --from/--to are mutually exclusive.");
      process.exit(0);
    }

    if ((opts.from && !opts.to) || (!opts.from && opts.to)) {
      console.error("--from and --to must be used together.");
      process.exit(0);
    }

    let fromDate: string;
    let toDate: string;
    let multiMonth = false;

    if (opts.year) {
      const year = parseYear(opts.year);
      if (!year) {
        console.error(`Invalid year: "${opts.year}". Expected YYYY.`);
        process.exit(0);
        return;
      }
      const bounds = yearBounds(year);
      fromDate = bounds.fromDate;
      toDate = bounds.toDate;
      multiMonth = true;
    } else if (opts.from && opts.to) {
      fromDate = new Date(validateDate(opts.from)).toISOString();
      toDate = new Date(validateDate(opts.to) + "T23:59:59.999Z").toISOString();
      multiMonth = true;
    } else {
      let month: number;
      let year: number;
      if (opts.month) {
        const parsed = parseMonth(opts.month);
        if (!parsed) {
          console.error(`Invalid month: "${opts.month}". Expected MM-YYYY.`);
          process.exit(0);
          return;
        }
        month = parsed.month;
        year = parsed.year;
      } else {
        const now = new Date();
        month = now.getMonth() + 1;
        year = now.getFullYear();
      }
      const bounds = monthBounds(month, year);
      fromDate = bounds.fromDate;
      toDate = bounds.toDate;
    }

    const csvContent = await fetchCSV(fromDate, toDate);
    const txns = parseTransactionsCSV(csvContent);
    const months = aggregateByMonth(txns, fromDate, toDate);

    // Fetch cash balance if the range includes the current month
    let cash: { total: number; free: number; invested: number; ppl: number } | undefined;
    if (isCurrentMonth(fromDate, toDate)) {
      const raw = await t212Get("/equity/account/cash");
      cash = { total: raw.total, free: raw.free, invested: raw.invested, ppl: raw.ppl };
    }

    // Fetch currency
    const accountInfo = await t212Get("/equity/account/info");
    const currency: string = accountInfo.currencyCode ?? "GBP";

    if (opts.json) {
      writeJson({ currency, months, cash });
      return;
    }

    if (!multiMonth || months.length <= 1) {
      const m = months[0] ?? {
        label: monthLabel(monthKey(fromDate)),
        deposits: 0,
        withdrawals: 0,
        interest: 0,
        dividends: 0,
        netIn: 0,
      };
      console.log(`Month:        ${m.label}`);
      console.log(`Deposits:     ${formatAmount(m.deposits)}`);
      console.log(`Withdrawals:  ${formatAmount(m.withdrawals)}`);
      console.log(`Interest:     ${formatAmount(m.interest)}`);
      console.log(`Dividends:    ${formatAmount(m.dividends)}`);
      console.log(`Net in:       ${formatAmount(m.netIn)}`);
      if (cash) {
        console.log("─────────────────────");
        console.log(`Balance:      ${formatAmount(cash.total)}`);
        console.log(`Invested:     ${formatAmount(cash.invested)}`);
        console.log(`Free cash:    ${formatAmount(cash.free)}`);
        const pplSign = cash.ppl >= 0 ? "+" : "";
        console.log(`P&L:          ${pplSign}${formatAmount(cash.ppl)}`);
        console.log(`Currency:     ${currency}`);
      }
    } else {
      const colW = { month: 12, dep: 10, wdr: 13, int: 10, div: 11, net: 9 };

      const header =
        "Month".padEnd(colW.month) +
        "Deposits".padStart(colW.dep) +
        "Withdrawals".padStart(colW.wdr) +
        "Interest".padStart(colW.int) +
        "Dividends".padStart(colW.div) +
        "Net in".padStart(colW.net);

      const sep =
        "-----".padEnd(colW.month) +
        "--------".padStart(colW.dep) +
        "-----------".padStart(colW.wdr) +
        "--------".padStart(colW.int) +
        "---------".padStart(colW.div) +
        "------".padStart(colW.net);

      console.log(header);
      console.log(sep);

      let totDep = 0, totWdr = 0, totInt = 0, totDiv = 0, totNet = 0;

      for (const m of months) {
        totDep += m.deposits;
        totWdr += m.withdrawals;
        totInt += m.interest;
        totDiv += m.dividends;
        totNet += m.netIn;

        console.log(
          m.label.padEnd(colW.month) +
            formatAmount(m.deposits).padStart(colW.dep) +
            formatAmount(m.withdrawals).padStart(colW.wdr) +
            formatAmount(m.interest).padStart(colW.int) +
            formatAmount(m.dividends).padStart(colW.div) +
            formatAmount(m.netIn).padStart(colW.net)
        );
      }

      console.log(sep);
      console.log(
        "TOTAL".padEnd(colW.month) +
          formatAmount(totDep).padStart(colW.dep) +
          formatAmount(totWdr).padStart(colW.wdr) +
          formatAmount(totInt).padStart(colW.int) +
          formatAmount(totDiv).padStart(colW.div) +
          formatAmount(totNet).padStart(colW.net)
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
