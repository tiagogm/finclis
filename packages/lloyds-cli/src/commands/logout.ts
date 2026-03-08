import { loadSession, clearSession } from "../auth.js";
import { getClient, cleanup } from "../client.js";

export async function logoutCommand(): Promise<void> {
  const session = loadSession();

  if (!session) {
    console.log("No active session.");
    return;
  }

  // Best-effort: server-side logout
  try {
    const client = await getClient();
    await client.performLogout();
    console.log("Server-side logout successful.");
  } catch (err: any) {
    console.warn(`Warning: server-side logout failed: ${err.message}`);
  } finally {
    await cleanup();
  }

  clearSession();
  console.log("Logged out.");
}
