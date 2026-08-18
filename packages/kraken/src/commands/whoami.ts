import { krakenPublicGet, krakenPrivatePost } from "../client.js";
import { handleJsonError, writeJson } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function whoamiCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const status = await krakenPublicGet("/0/public/SystemStatus");
    const balance = await krakenPrivatePost("/0/private/Balance", {});

    if (opts.json) {
      writeJson({ status, assetCount: Object.keys(balance || {}).length });
      return;
    }

    console.log(`Exchange status: ${status.status}`);
    console.log(`Server time:     ${status.timestamp}`);
    console.log(`Authenticated:   yes (${Object.keys(balance || {}).length} asset(s) in account)`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
