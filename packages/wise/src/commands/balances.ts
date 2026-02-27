import { wiseGet, getProfileId } from "../client.js";

export async function balancesCommand(): Promise<void> {
  try {
    const profileId = getProfileId();
    const balances = await wiseGet(
      `/v4/profiles/${profileId}/balances?types=STANDARD,SAVINGS`
    );

    // Header
    console.log("ID\tType\tCurrency\tBalance");
    console.log("--\t----\t--------\t-------");

    for (const b of balances) {
      const id = b.id || b.balanceId || "?";
      const type = b.type || "STANDARD";
      const currency = b.currency;
      const amount = b.amount.value.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      console.log(`${id}\t${type}\t${currency}\t\t${amount}`);
    }
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    process.exit(0);
  }
}
