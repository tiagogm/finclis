import { wiseGet } from "../client.js";

export async function profilesCommand(): Promise<void> {
  try {
    const profiles = await wiseGet("/v2/profiles");
    for (const p of profiles) {
      const name =
        p.type === "PERSONAL"
          ? `${p.details.firstName} ${p.details.lastName}`
          : p.details.name;
      console.log(`${p.id}\t${p.type}\t${name}`);
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
