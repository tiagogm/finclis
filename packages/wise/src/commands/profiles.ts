import { wiseGet } from "../client.js";
import { writeJson, handleJsonError } from "@finclis/cli-utils";
import type { BaseCommandOpts } from "@finclis/cli-utils";

export async function profilesCommand(opts: BaseCommandOpts = {}): Promise<void> {
  try {
    const profiles = await wiseGet("/v2/profiles");

    if (opts.json) {
      writeJson(profiles);
      return;
    }

    for (const p of profiles) {
      let name = "Unknown";
      if (p.details) {
        name =
          p.type === "PERSONAL"
            ? `${p.details.firstName || ""} ${p.details.lastName || ""}`.trim()
            : p.details.name || "Unknown";
      } else if (p.fullName) {
        name = p.fullName;
      }
      console.log(`${p.id}\t${p.type}\t${name}`);
    }
  } catch (err: any) {
    if (opts.json) handleJsonError(err);
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
