import { vanguardPost, requireSession, cleanup } from "../client.js";
import { formatGBP } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function holdingsCommand(opts: BaseCommandOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const hId = session.hierarchyId;
    const result = await vanguardPost(
      `/en-GB/SubAccount/${hId}/Api/Portfolio/InstrumentValuation/Post`,
      {
        query: { Sorting: { Direction: 1, Field: 0 } },
        hierarchyId: hId,
      }
    );

    // Result is an array of holdings: { Name, Type (1=cash, 3=fund), Value: { Amount }, PercentageOfPortfolio }
    const instruments = Array.isArray(result) ? result : [];

    if (opts.json) {
      writeJson(instruments);
      await cleanup();
      process.exit(0);
    }

    if (instruments.length === 0) {
      console.log("No holdings found.");
      await cleanup();
      process.exit(0);
    }

    // Header
    const nameW = 40;
    const typeW = 8;
    const valueW = 15;
    const pctW = 11;

    console.log(
      "Name".padEnd(nameW) +
        "Type".padEnd(typeW) +
        "Value".padStart(valueW) +
        "% Portfolio".padStart(pctW)
    );
    console.log(
      "----".padEnd(nameW) +
        "----".padEnd(typeW) +
        "-----".padStart(valueW) +
        "-----------".padStart(pctW)
    );

    for (const inst of instruments) {
      const name = (inst.Name ?? "Unknown").slice(0, nameW - 2);
      const type = inst.Type === 1 ? "Cash" : "Fund";
      const value = inst.Value?.Amount ?? 0;
      const pct = (inst.PercentageOfPortfolio ?? 0).toFixed(2);

      console.log(
        name.padEnd(nameW) +
          type.padEnd(typeW) +
          `£${formatGBP(value)}`.padStart(valueW) +
          pct.padStart(pctW)
      );
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
