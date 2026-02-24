const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCurrency(code: string): string {
  const upper = code.toUpperCase();
  if (!CURRENCY_RE.test(upper)) {
    console.error(`Invalid currency code: "${code}". Expected 3 letters (e.g. EUR, GBP).`);
    process.exit(1);
  }
  return upper;
}

export function validateDate(value: string): string {
  if (!DATE_RE.test(value)) {
    console.error(`Invalid date: "${value}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    console.error(`Invalid date: "${value}".`);
    process.exit(1);
  }
  return value;
}

export function validateBalanceId(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id) || id <= 0) {
    console.error(`Invalid balance ID: "${value}". Expected a positive number.`);
    process.exit(1);
  }
  return id;
}
