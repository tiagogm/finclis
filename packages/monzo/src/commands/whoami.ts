import { monzoGet, requireSession } from "../client.js";
import { writeJson, handleJsonError } from "../json.js";
import type { BaseCommandOpts } from "../json.js";

export async function whoamiCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const session = await requireSession();
    const data = await monzoGet("/ping/whoami");

    if (opts.json) {
      writeJson({ ...data, account_id: session.account_id });
      return;
    }

    console.log(`authenticated: ${data.authenticated}`);
    console.log(`client_id:     ${data.client_id}`);
    console.log(`user_id:       ${data.user_id}`);
    console.log(`account_id:    ${session.account_id}`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
