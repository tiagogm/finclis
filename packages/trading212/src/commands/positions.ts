import { t212Get } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function positionsCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const positions = await t212Get("/equity/portfolio");

    if (opts.json) {
      writeJson(positions);
      return;
    }

    if (!positions.length) {
      console.log("No open positions.");
      return;
    }

    const fmt = (n: number) => n.toFixed(4);
    const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
    console.log(
      `${"Ticker".padEnd(12)} ${"Qty".padStart(10)} ${"Avg Price".padStart(12)} ${"Cur Price".padStart(12)} ${"P&L".padStart(12)} ${"Return".padStart(10)}`
    );
    console.log("-".repeat(72));
    for (const p of positions) {
      const ppl = p.ppl ?? 0;
      const ret = p.averagePrice && p.currentPrice
        ? ((p.currentPrice - p.averagePrice) / p.averagePrice) * 100
        : 0;
      console.log(
        `${String(p.ticker).padEnd(12)} ${fmt(p.quantity).padStart(10)} ${fmt(p.averagePrice ?? 0).padStart(12)} ${fmt(p.currentPrice ?? 0).padStart(12)} ${ppl.toFixed(2).padStart(12)} ${fmtPct(ret).padStart(10)}`
      );
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
