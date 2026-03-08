import { vanguardGet, requireSession } from "../client.js";
import {
  validateDate,
  parseMonth,
  parseYear,
  monthBounds,
  yearBounds,
  formatGBP,
} from "../validate.js";
import {
  isPastMonth,
  saveCachedMonth,
  parseVanguardMonthLabel,
} from "../cache.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

interface SummaryOpts extends BaseCommandOpts {
  month?: string;
  year?: string;
  from?: string;
  to?: string;
}

export async function summaryCommand(opts: SummaryOpts): Promise<void> {
  const session = requireSession();

  try {
    // Validate mutually exclusive flags
    const flagCount = [opts.month, opts.year, opts.from || opts.to].filter(Boolean).length;
    if (flagCount > 1) {
      console.error("Options --month, --year, and --from/--to are mutually exclusive.");
      process.exit(0);
    }

    if ((opts.from && !opts.to) || (!opts.from && opts.to)) {
      console.error("--from and --to must be used together.");
      process.exit(0);
    }

    const hId = session.hierarchyId;
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
      // Single month (--month or default current month)
      let month: number;
      let year: number;
      if (opts.month) {
        const parsed = parseMonth(opts.month);
        if (!parsed) {
          console.error(`Invalid month: "${opts.month}". Expected YYYY-MM.`);
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

    const url =
      `/en-GB/Api/Performance/InvestmentMonthlyPerformance/Get?hierarchyId=${hId}&fromDate=${encodeURIComponent(fromDate!)}&toDate=${encodeURIComponent(toDate!)}`;

    // API returns array of { PerformanceDetail: { OpeningValue: {Amount}, ... }, Month: "Jan 2026" }
    const data = await vanguardGet(url);
    const months: any[] = Array.isArray(data) ? data : [];

    if (opts.json) {
      writeJson(data);
      return;
    }

    if (months.length === 0) {
      console.log("No data available for the requested period.");
      return;
    }

    // Helper to extract values from the nested PerformanceDetail shape
    function pd(m: any) {
      const d = m.PerformanceDetail ?? {};
      return {
        label: m.Month ?? "?",
        open: d.OpeningValue?.Amount ?? 0,
        close: d.ClosingValue?.Amount ?? 0,
        dep: d.PaymentsIn?.Amount ?? 0,
        wdr: d.PaymentsOut?.Amount ?? 0,
        gain: d.NetGain?.Amount ?? 0,
        int: d.NetInterest?.Amount ?? 0,
        div: d.NetDividends?.Amount ?? 0,
        returnPct: (d.NetReturn ?? 0) * 100,
      };
    }

    // Cache past months
    for (const m of months) {
      const label = m.Month ?? "";
      const parsed = parseVanguardMonthLabel(label);
      if (parsed && isPastMonth(parsed.month, parsed.year)) {
        saveCachedMonth(parsed.year, parsed.month, m);
      }
    }

    if (!multiMonth || months.length === 1) {
      // Single month output
      const v = pd(months[0]);
      const sign = v.gain >= 0 ? "+" : "";
      const retSign = v.returnPct >= 0 ? "+" : "";
      console.log(`Month:        ${v.label}`);
      console.log(`Opening:      £${formatGBP(v.open)}`);
      console.log(`Closing:      £${formatGBP(v.close)}`);
      console.log(`Deposits:     £${formatGBP(v.dep)}`);
      console.log(`Withdrawals:  £${formatGBP(v.wdr)}`);
      console.log(`Net Gain:     ${sign}£${formatGBP(Math.abs(v.gain))}`);
      console.log(`Interest:     £${formatGBP(v.int)}`);
      console.log(`Dividends:    £${formatGBP(v.div)}`);
      console.log(`Return:       ${retSign}${v.returnPct.toFixed(2)}%`);
    } else {
      // Multi-month table output
      const colW = {
        month: 12,
        open: 13,
        close: 13,
        dep: 10,
        wdr: 13,
        gain: 11,
        int: 10,
        div: 10,
      };

      const header =
        "Month".padEnd(colW.month) +
        "Opening".padStart(colW.open) +
        "Closing".padStart(colW.close) +
        "Deposits".padStart(colW.dep) +
        "Withdrawals".padStart(colW.wdr) +
        "Net Gain".padStart(colW.gain) +
        "Interest".padStart(colW.int) +
        "Dividends".padStart(colW.div);

      const separator =
        "-----".padEnd(colW.month) +
        "-------".padStart(colW.open) +
        "-------".padStart(colW.close) +
        "--------".padStart(colW.dep) +
        "-----------".padStart(colW.wdr) +
        "--------".padStart(colW.gain) +
        "--------".padStart(colW.int) +
        "---------".padStart(colW.div);

      console.log(header);
      console.log(separator);

      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let totalNetGain = 0;
      let totalInterest = 0;
      let totalDividends = 0;

      for (const m of months) {
        const v = pd(m);
        totalDeposits += v.dep;
        totalWithdrawals += v.wdr;
        totalNetGain += v.gain;
        totalInterest += v.int;
        totalDividends += v.div;

        const gainSign = v.gain >= 0 ? "+" : "";
        console.log(
          v.label.padEnd(colW.month) +
            `£${formatGBP(v.open)}`.padStart(colW.open) +
            `£${formatGBP(v.close)}`.padStart(colW.close) +
            `£${formatGBP(v.dep)}`.padStart(colW.dep) +
            `£${formatGBP(v.wdr)}`.padStart(colW.wdr) +
            `${gainSign}£${formatGBP(Math.abs(v.gain))}`.padStart(colW.gain) +
            `£${formatGBP(v.int)}`.padStart(colW.int) +
            `£${formatGBP(v.div)}`.padStart(colW.div)
        );
      }

      console.log(separator);

      const firstOpen = pd(months[0]).open;
      const lastClose = pd(months[months.length - 1]).close;
      const totalGainSign = totalNetGain >= 0 ? "+" : "";
      console.log(
        "TOTAL".padEnd(colW.month) +
          `£${formatGBP(firstOpen)}`.padStart(colW.open) +
          `£${formatGBP(lastClose)}`.padStart(colW.close) +
          `£${formatGBP(totalDeposits)}`.padStart(colW.dep) +
          `£${formatGBP(totalWithdrawals)}`.padStart(colW.wdr) +
          `${totalGainSign}£${formatGBP(Math.abs(totalNetGain))}`.padStart(colW.gain) +
          `£${formatGBP(totalInterest)}`.padStart(colW.int) +
          `£${formatGBP(totalDividends)}`.padStart(colW.div)
      );
    }

  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
