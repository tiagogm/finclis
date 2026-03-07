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

    const remainingSecs = session.expires_at - Math.floor(Date.now() / 1000);
    let expiresIn: string;
    if (remainingSecs <= 0) {
      expiresIn = "expired";
    } else if (remainingSecs < 60) {
      expiresIn = `${remainingSecs}s`;
    } else if (remainingSecs < 3600) {
      expiresIn = `${Math.floor(remainingSecs / 60)}m`;
    } else {
      const h = Math.floor(remainingSecs / 3600);
      const m = Math.floor((remainingSecs % 3600) / 60);
      expiresIn = m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    console.log(`authenticated: ${data.authenticated}`);
    console.log(`client_id:     ${data.client_id}`);
    console.log(`user_id:       ${data.user_id}`);
    console.log(`account_id:    ${session.account_id}`);
    console.log(`token_expires: in ${expiresIn}`);
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
