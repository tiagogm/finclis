const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDate(value: string): string {
  if (!DATE_RE.test(value)) {
    console.error(`Invalid date: "${value}". Expected YYYY-MM-DD.`);
    process.exit(0);
  }
  const d = parseDateValue(value);
  if (isNaN(d.getTime())) {
    console.error(`Invalid date: "${value}".`);
    process.exit(0);
  }
  return value;
}

export function parseDateValue(value: string): Date {
  if (!DATE_RE.test(value)) {
    console.error(`Invalid date: "${value}". Expected YYYY-MM-DD.`);
    process.exit(0);
  }
  const [yyyy, mm, dd] = value.split("-");
  const d = new Date(Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)));
  if (isNaN(d.getTime())) {
    console.error(`Invalid date: "${value}".`);
    process.exit(0);
  }
  return d;
}

const MONTH_RE = /^(\d{4})-(\d{1,2})$/;

export function parseMonth(value: string): { month: number; year: number } | null {
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function monthBounds(month: number, year: number): { since: string; before: string } {
  const since = new Date(Date.UTC(year, month - 1, 1));
  const before = new Date(Date.UTC(year, month, 1));
  return {
    since: since.toISOString(),
    before: before.toISOString(),
  };
}
