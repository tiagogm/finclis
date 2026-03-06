import { vanguardGet, requireSession } from "../client.js";
import { formatGBP } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function performanceCommand(opts: BaseCommandOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const hId = session.hierarchyId;
    const perf = await vanguardGet(
      `/en-GB/SubAccount/${hId}/Api/Performance/SubaccountPerformance/Get?hierarchyId=${hId}&grossReturnOnly=true`
    );

    if (opts.json) {
      writeJson(perf);
      return;
    }

    // API shape: { Value: { Amount }, PercentageChange, AmountChange: { Amount } }
    const currentValue = perf.Value?.Amount ?? 0;
    const totalReturn = perf.AmountChange?.Amount ?? 0;
    const returnPct = perf.PercentageChange ?? 0;

    const sign = totalReturn >= 0 ? "+" : "";

    console.log(`Current Value:   £${formatGBP(currentValue)}`);
    console.log(
      `Total Return:    ${sign}£${formatGBP(Math.abs(totalReturn))} (${sign}${returnPct.toFixed(2)}%)`
    );
    console.log(`Since:           inception`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
