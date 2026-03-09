import { saveSession, prompt } from "../auth.js";

export async function loginCommand(): Promise<void> {
  console.log("Enter your Kraken API credentials.");
  console.log("Create keys at: https://www.kraken.com/u/security/api\n");
  console.log("Required key permissions: Query Funds, Query Open Orders & Trades,");
  console.log("Query Closed Orders & Trades, Query Ledger Entries, Create & Modify Orders\n");

  const apiKey = await prompt("API Key: ");
  const apiSecret = await prompt("API Secret: ", true);

  if (!apiKey.trim() || !apiSecret.trim()) {
    console.error("API key and secret are required.");
    process.exit(1);
  }

  await saveSession({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
  console.log("Credentials saved to keychain. Run: kraken whoami");
}
