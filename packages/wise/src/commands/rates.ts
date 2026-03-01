import { wiseGet } from "../client.js";
import { validateCurrency } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function ratesCommand(
  source: string,
  target: string,
  opts: BaseCommandOpts = {}
): Promise<void> {
  try {
    const src = validateCurrency(source);
    const tgt = validateCurrency(target);

    const params = new URLSearchParams({ source: src, target: tgt });
    const rates = await wiseGet(`/v1/rates?${params}`);

    if (opts.json) {
      writeJson(rates);
      return;
    }

    if (rates.length === 0) {
      console.error(`No rate found for ${src} → ${tgt}`);
      process.exit(0);
    }
    const rate = rates[0];
    console.log(
      `${rate.source} → ${rate.target}\t${rate.rate}\t(${rate.time})`
    );
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
