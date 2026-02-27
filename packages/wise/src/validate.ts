const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCurrency(code: string): string {
  const upper = code.toUpperCase();
  if (!CURRENCY_RE.test(upper)) {
    console.error(`Invalid currency code: "${code}". Expected 3 letters (e.g. EUR, GBP).`);
    process.exit(0);
  }
  return upper;
}

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

export function validateBalanceId(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0) {
    console.error(`Invalid balance ID: "${value}". Expected a positive number.`);
    process.exit(0);
  }
  return id;
}

const MONTH_RE = /^(\d{1,2})-(\d{4})$/;

export function parseMonth(value: string): { month: number; year: number } | null {
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function monthBounds(month: number, year: number): { since: string; until: string } {
  const since = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const until = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
  return {
    since: since.toISOString(),
    until: until.toISOString(),
  };
}
