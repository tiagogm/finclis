import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { invalidateSession } from "../auth.js";

const SESSION_PATH = path.join(os.homedir(), ".wise-cli", "session.json");

export async function logoutCommand(): Promise<void> {
  let token: string | null = null;
  try {
    const raw = fs.readFileSync(SESSION_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") {
      token = parsed.token;
    }
  } catch {
    // no file
  }

  if (!token) {
    console.log("No active session.");
    return;
  }

  try {
    await invalidateSession(token);
    console.log("Logged out.");
  } catch (err: any) {
    console.error(`Logout failed: ${err.message}`);
    process.exit(0);
  }
}
