import { vanguardGet, requireSession, cleanup } from "../client.js";
import { DEFAULT_TTL_MS } from "../auth.js";
import { formatGBP } from "../validate.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function whoamiCommand(opts: BaseCommandOpts = {}): Promise<void> {
  const session = requireSession();

  try {
    const hId = session.hierarchyId;
    const valuation = await vanguardGet(
      `/en-GB/SubAccount/${hId}/Api/Valuations/CurrentValuation/Get`
    );

    if (opts.json) {
      writeJson(valuation);
      await cleanup();
      process.exit(0);
    }

    console.log(`Hierarchy ID:    ${hId}`);
    console.log(`Portfolio Value: £${formatGBP(valuation.Value?.Amount ?? 0)}`);
    if (valuation.AsAt) {
      console.log(`As At:           ${valuation.AsAt}`);
    }

    // Session expiry
    const ttl = session.ttlMs ?? DEFAULT_TTL_MS;
    const remaining = ttl - (Date.now() - session.createdAt);
    if (remaining > 0) {
      const secs = Math.floor(remaining / 1000);
      const mins = Math.floor(secs / 60);
      const hours = Math.floor(mins / 60);
      const label = hours > 0 ? `${hours}h ${mins % 60}m` : mins > 0 ? `${mins}m` : `${secs}s`;
      console.log(`Expires in:      ${label}`);
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
