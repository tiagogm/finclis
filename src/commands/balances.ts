import { wiseGet, getProfileId } from "../client.js";

export async function balancesCommand(): Promise<void> {
  try {
    const profileId = getProfileId();
    const balances = await wiseGet(
      `/v4/profiles/${profileId}/balances?types=STANDARD`
    );
    for (const b of balances) {
      const currency = b.currency;
      const amount = b.amount.value.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      console.log(`${currency}\t${amount}`);
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
  }
}
