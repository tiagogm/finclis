export function formatMoney(pence: number, currency = "GBP"): string {
  const amount = pence / 100;
  return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
