import { wiseGet } from "../client.js";

export async function ratesCommand(
  source: string,
  target: string
): Promise<void> {
  try {
    const rates = await wiseGet(
      `/v1/rates?source=${source.toUpperCase()}&target=${target.toUpperCase()}`
    );
    if (rates.length === 0) {
      console.error(`No rate found for ${source} → ${target}`);
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
