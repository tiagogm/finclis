import { loadCredentials, saveCredentials, clearCredentials, prompt } from "../auth.js";

export async function authViewCommand(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    console.log("No credentials stored. Run: kraken auth set");
    return;
  }
  const masked = creds.apiSecret.length > 12
    ? creds.apiSecret.slice(0, 6) + "…" + creds.apiSecret.slice(-6)
    : "****";
  console.log(`apiKey:    ${creds.apiKey}`);
  console.log(`apiSecret: ${masked}`);
  console.log(`2FA:       ${creds.twoFactor ? "enabled" : "disabled"}`);
}

export async function authSetCommand(): Promise<void> {
  console.log("Enter your Kraken API credentials.");
  console.log("Create keys at: https://www.kraken.com/u/security/api\n");
  console.log("Required key permissions: Query Funds, Query Open Orders & Trades,");
  console.log("Query Closed Orders & Trades, Query Ledger Entries, Create & Modify Orders\n");

  const apiKey = await prompt("API Key: ");
  const apiSecret = await prompt("API Secret: ", true);
  const twoFactorInput = await prompt("2FA enabled on this key? (y/n): ");

  if (!apiKey.trim() || !apiSecret.trim()) {
    console.error("API key and secret are required.");
    process.exit(1);
  }

  const twoFactor = twoFactorInput.trim().toLowerCase() === "y";
  await saveCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), twoFactor });
  console.log("Credentials saved. Run: kraken whoami");
}

export async function authClearCommand(): Promise<void> {
  await clearCredentials();
  console.log("Credentials removed.");
  console.log("Note: API keys remain active on Kraken until manually revoked.");
}
