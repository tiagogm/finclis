import { clearSession, loadSession } from "../auth.js";

export async function logoutCommand(): Promise<void> {
  const session = await loadSession();
  if (!session) {
    console.log("No active session.");
    return;
  }
  await clearSession();
  console.log("Logged out. Credentials removed from keychain.");
  console.log("Note: API keys remain active on Kraken until manually revoked.");
}
