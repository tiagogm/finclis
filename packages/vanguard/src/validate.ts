const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{1,2})-(\d{4})$/;
const YEAR_RE = /^(\d{4})$/;

export function validateDate(value: string): string {
  if (!DATE_RE.test(value)) {
    console.error(`Invalid date: "${value}". Expected YYYY-MM-DD.`);
    process.exit(0);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    console.error(`Invalid date: "${value}".`);
    process.exit(0);
  }
  return value;
}

export function parseMonth(value: string): { month: number; year: number } | null {
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function parseYear(value: string): number | null {
  const m = YEAR_RE.exec(value);
  if (!m) return null;
  return parseInt(m[1], 10);
}

export function monthBounds(
  month: number,
  year: number
): { fromDate: string; toDate: string } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
  return {
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
  };
}

export function yearBounds(year: number): { fromDate: string; toDate: string } {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return {
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
  };
}

export function formatGBP(amount: number): string {
  return amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
