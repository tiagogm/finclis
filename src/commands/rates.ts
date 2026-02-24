import { wiseGet } from "../client.js";
import { validateCurrency } from "../validate.js";

export async function ratesCommand(
  source: string,
  target: string
): Promise<void> {
  try {
    const src = validateCurrency(source);
    const tgt = validateCurrency(target);

    const params = new URLSearchParams({ source: src, target: tgt });
    const rates = await wiseGet(`/v1/rates?${params}`);
    if (rates.length === 0) {
      console.error(`No rate found for ${src} → ${tgt}`);
      process.exit(1);
    }
    const rate = rates[0];
    console.log(
      `${rate.source} → ${rate.target}\t${rate.rate}\t(${rate.time})`
    );
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
