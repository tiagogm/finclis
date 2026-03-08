import { t212Get } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function cashCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const cash = await t212Get("/equity/account/cash");

    if (opts.json) {
      writeJson(cash);
      return;
    }

    const fmt = (n: number) => n.toFixed(2);
    console.log(`Free:      ${fmt(cash.free)}`);
    console.log(`Invested:  ${fmt(cash.invested)}`);
    console.log(`Result:    ${fmt(cash.result)}`);
    console.log(`Total:     ${fmt(cash.total)}`);
    if (cash.ppl !== undefined) {
      console.log(`P&L:       ${fmt(cash.ppl)}`);
    }
    if (cash.pieCash !== undefined) {
      console.log(`Pie cash:  ${fmt(cash.pieCash)}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
