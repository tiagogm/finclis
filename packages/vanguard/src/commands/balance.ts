import { vanguardGet, requireSession, cleanup } from "../client.js";
import { formatGBP } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function balanceCommand(opts: BaseCommandOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const hId = session.hierarchyId;
    const [valuation, cashBalance] = await Promise.all([
      vanguardGet(
        `/en-GB/SubAccount/${hId}/Api/Valuations/CurrentValuation/Get`
      ),
      vanguardGet(
        `/en-GB/SubAccount/${hId}/Api/Portfolio/CashBalance/Get?hierarchyId=${hId}`
      ),
    ]);

    if (opts.json) {
      writeJson({ valuation, cashBalance });
      await cleanup();
      process.exit(0);
    }

    const total = valuation.Value?.Amount ?? 0;
    const cash = cashBalance.Amount ?? 0;
    const invested = total - cash;

    console.log(`Total:    £${formatGBP(total)}`);
    console.log(`Invested: £${formatGBP(invested)}`);
    console.log(`Cash:     £${formatGBP(cash)}`);
    if (valuation.AsAt) {
      console.log(`As At:    ${valuation.AsAt}`);
    }

    await cleanup();
    process.exit(0);
  } catch (err: any) {
    if (opts.json) { await cleanup(); handleJsonError(err); }
    await cleanup();
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
