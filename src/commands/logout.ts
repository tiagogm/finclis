import { API_URL, loadSession, clearSession } from "../auth.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export async function logoutCommand(): Promise<void> {
  const session = loadSession();

  if (!session) {
    console.log("No active session.");
    return;
  }

  // Try to invalidate the token via API
  try {
    await fetch(`${API_URL}/v1/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    });
  } catch {
    // Best-effort — don't fail logout if API call fails
  }

  // Clear local session file
  clearSession();

  // Clean up browser profile
  const browserDir = path.join(os.homedir(), ".wise-cli", "browser-profile");
  try {
    fs.rmSync(browserDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }

  console.log("Logged out. Session cleared.");
}
