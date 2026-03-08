import { t212Get, getEnv } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function whoamiCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const info = await t212Get("/equity/account/info");
    const env = await getEnv();

    if (opts.json) {
      writeJson({ ...info, env });
      return;
    }

    console.log(`Account ID: ${info.id}`);
    console.log(`Currency:   ${info.currencyCode}`);
    console.log(`Environment: ${env}`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
