import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface Session {
  token: string;
  profileId: number;
}

const DEFAULT_SESSION_PATH = path.join(
  os.homedir(),
  ".wise-cli",
  "session.json"
);

export function saveSession(
  session: Session,
  sessionPath = DEFAULT_SESSION_PATH
): void {
  const dir = path.dirname(sessionPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
}

export function loadSession(
  sessionPath = DEFAULT_SESSION_PATH
): Session | null {
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(sessionPath = DEFAULT_SESSION_PATH): void {
  try {
    fs.unlinkSync(sessionPath);
  } catch {
    // file doesn't exist, that's fine
  }
}
