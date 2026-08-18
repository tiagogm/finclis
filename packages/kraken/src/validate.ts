// MONTH_RE matches YYYY-MM (ISO-consistent, same pattern as wise/validate.ts)
const MONTH_RE = /^(\d{4})-(\d{1,2})$/;

export function parseMonth(value: string): { month: number; year: number } | null {
  const match = MONTH_RE.exec(value);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function monthBounds(
  month: number,
  year: number
): { start: number; end: number; label: string } {
  const start = Math.floor(Date.UTC(year, month - 1, 1) / 1000);
  const end = Math.floor(Date.UTC(year, month, 1) / 1000) - 1;
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start, end, label };
}
