import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const BASE_URL = "https://api.wise.com";

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

async function prompt(question: string, hidden = false): Promise<string> {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);
      let input = "";
      const onData = (char: Buffer) => {
        const c = char.toString("utf-8");
        if (c === "\n" || c === "\r") {
          stdin.removeListener("data", onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (c === "\u0003") {
          process.exit(0);
        } else if (c === "\u007F" || c === "\b") {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

export async function login(): Promise<Session> {
  const email = await prompt("Email: ");
  const password = await prompt("Password: ", true);

  const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      username: email,
      password,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Auth failed (${tokenRes.status})`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const token = tokenData.access_token;

  const profilesRes = await fetch(`${BASE_URL}/v2/profiles`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!profilesRes.ok) {
    throw new Error(`Failed to fetch profiles (${profilesRes.status})`);
  }

  const profiles = (await profilesRes.json()) as Array<{
    id: number;
    type: string;
  }>;
  const personal = profiles.find((p) => p.type === "PERSONAL");
  if (!personal) {
    throw new Error("No personal profile found");
  }

  const session: Session = { token, profileId: personal.id };
  saveSession(session);
  console.log(`Logged in (profile ${session.profileId})`);
  return session;
}
