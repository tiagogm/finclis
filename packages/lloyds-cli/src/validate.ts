const MONTH_RE = /^(\d{1,2})-(\d{4})$/;

export function parseMonth(value: string): { year: number; month: number; key: string } | null {
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const year = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month, key: `${year}-${String(month).padStart(2, "0")}` };
}

export function isPastMonth(year: number, month: number): boolean {
  const now = new Date();
  return (
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth() + 1)
  );
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatGBP(amount: number): string {
  return amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
