import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

export const BASE_URL = "https://wise.com";
export const API_URL = "https://api.wise.com";

export interface Session {
  token: string;
  profileId: number;
  createdAt?: number; // epoch ms
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
}

export function loadSession(
  sessionPath = DEFAULT_SESSION_PATH
): Session | null {
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate structure
    if (!parsed || typeof parsed.token !== "string" || typeof parsed.profileId !== "number") {
      return null;
    }

    // Check expiry (skip if no createdAt — backward compat with old sessions)
    if (parsed.createdAt && Date.now() - parsed.createdAt > SESSION_TTL_MS) {
      console.error("Session expired. Run: wise login");
      return null;
    }

    return parsed as Session;
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

export async function prompt(question: string, hidden = false): Promise<string> {
  if (hidden) {
    const { execSync } = await import("node:child_process");

    const restoreEcho = () => {
      try { execSync("stty echo", { stdio: "inherit" }); } catch {}
    };

    // Safety net: restore echo if process exits unexpectedly
    process.on("exit", restoreEcho);
    process.on("SIGINT", () => { restoreEcho(); process.exit(130); });
    process.on("SIGTERM", () => { restoreEcho(); process.exit(143); });

    process.stdout.write(question);
    try {
      execSync("stty -echo", { stdio: "inherit" });
      const rl = readline.createInterface({
        input: process.stdin,
        output: new (await import("node:stream")).Writable({
          write(_chunk, _encoding, callback) { callback(); },
        }),
      });
      const answer = await new Promise<string>((resolve) => {
        rl.question("", (ans) => {
          rl.close();
          resolve(ans);
        });
      });
      return answer;
    } finally {
      restoreEcho();
      process.stdout.write("\n");
      process.removeListener("exit", restoreEcho);
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Login to Wise via browser.
 *
 * Opens a Chromium window to wise.com/login. User logs in normally
 * (captcha + 2FA handled by the browser). Once logged in, we intercept
 * the access token from API responses and extract the profile ID.
 */
export async function login(): Promise<Session> {
  const { chromium } = await import("playwright");

  console.log("Opening browser for Wise login...");
  console.log("Complete login in the browser window (email + 2FA).\n");

  // Use a persistent profile so Turnstile doesn't flag us as automated.
  // launchPersistentContext avoids the automation detection flags.
  const userDataDir = path.join(os.homedir(), ".wise-cli", "browser-profile");
  fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const page = context.pages()[0] || await context.newPage();

  // Intercept API responses to capture the access token
  let accessToken: string | null = null;

  // Capture token from ANY response that contains access_token
  page.on("response", async (response) => {
    if (accessToken) return; // already got it
    const url = response.url();
    const contentType = response.headers()["content-type"] || "";
    if (!contentType.includes("json")) return;

    try {
      const body = await response.json();
      if (body && typeof body === "object" && body.access_token) {
        accessToken = body.access_token;
      }
    } catch {
      // not parseable
    }
  });

  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);

  // Wait for the user to complete login and land on a logged-in page
  console.log("Waiting for login to complete...");
  try {
    await page.waitForURL(
      (url) => {
        const p = url.pathname;
        return (
          p.startsWith("/home") ||
          p.startsWith("/balances") ||
          p.startsWith("/account") ||
          p.startsWith("/recipients") ||
          (p === "/" && !url.href.includes("/login"))
        );
      },
      { timeout: 300_000 } // 5 minutes to complete login
    );
  } catch {
    await context.close();
    throw new Error("Login timed out — browser closed");
  }

  // Give a moment for any final responses to arrive
  await page.waitForTimeout(3000);

  // If we didn't capture from response interception, try all storage
  if (!accessToken) {
    // Check localStorage for access_token
    accessToken = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key);
        if (!val) continue;
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === "object" && parsed.access_token) {
            return parsed.access_token;
          }
        } catch {}
      }
      return null;
    });
  }

  if (!accessToken) {
    const cookies = await context.cookies();
    const oauthCookie = cookies.find((c) => c.name === "oauthToken");
    if (oauthCookie) {
      accessToken = oauthCookie.value;
    }
  }

  await context.close();

  if (!accessToken) {
    throw new Error(
      "Could not capture access token. Login may have failed or timed out."
    );
  }

  // Fetch profile to get profileId
  const profilesRes = await fetch(`${API_URL}/v2/profiles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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

  const session: Session = { token: accessToken, profileId: personal.id, createdAt: Date.now() };
  saveSession(session);
  console.log(`Authenticated successfully for profile ${session.profileId}. Session saved.`);
  return session;
}
