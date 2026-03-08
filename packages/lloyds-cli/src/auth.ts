import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_DIR = path.join(os.homedir(), ".lloyds-cli");
export const SESSION_PATH = path.join(SESSION_DIR, "session.json");
export const BROWSER_PROFILE_DIR = path.join(SESSION_DIR, "browser-profile");

const LLOYDS_SECURE_ROOT = "https://secure.lloydsbank.co.uk/";
const LLOYDS_DASHBOARD_PATTERN = /\/personal\/a\/account_overview_personal\//;
const ACCOUNTS_URL =
  "https://secure.lloydsbank.co.uk/personal/retail/aov-api/browser/aov/v1/accounts/account-type/C";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const BROWSER_LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
  "--disable-setuid-sandbox",
];

const BROWSER_CONTEXT_OPTIONS = {
  userAgent: USER_AGENT,
  viewport: { width: 1024, height: 768 } as const,
  locale: "en-GB",
  timezoneId: "Europe/London",
  permissions: [] as string[],
  hasTouch: false,
  isMobile: false,
};

export interface LloydsCliSession {
  arrangementId: string;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
  createdAt: number;
  lastAccessedAt?: number;
}

export function loadSession(): LloydsCliSession | null {
  try {
    const raw = fs.readFileSync(SESSION_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      !parsed?.arrangementId ||
      !Array.isArray(parsed.cookies) ||
      !Array.isArray(parsed.origins)
    ) {
      return null;
    }
    return parsed as LloydsCliSession;
  } catch {
    return null;
  }
}

export function saveSession(session: LloydsCliSession): void {
  fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
}

let _lastTouch = 0;

export function touchSession(): void {
  const now = Date.now();
  if (now - _lastTouch < 30_000) return; // at most one write per 30s
  _lastTouch = now;
  try {
    const session = loadSession();
    if (session) {
      session.lastAccessedAt = now;
      saveSession(session);
    }
  } catch {
    // best-effort — never block a command on this
  }
}

export function clearSession(): void {
  try {
    fs.unlinkSync(SESSION_PATH);
  } catch {
    // file doesn't exist, that's fine
  }
}


export async function authenticateWithBrowser(): Promise<LloydsCliSession> {
  const { chromium } = await import("playwright");

  console.log("Opening browser for Lloyds authentication...");

  // Use a persistent profile so Lloyds remembers your username and device.
  // This avoids the "remember this device" prompt on every login.
  fs.mkdirSync(BROWSER_PROFILE_DIR, { recursive: true, mode: 0o700 });

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: false,
    args: BROWSER_LAUNCH_ARGS,
    ignoreDefaultArgs: ["--enable-automation"],
    ...BROWSER_CONTEXT_OPTIONS,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Reuse existing tab or open a new one
  const page = context.pages()[0] ?? await context.newPage();
  for (const p of context.pages()) {
    if (p !== page) await p.close().catch(() => {});
  }

  try {
    console.log("Navigating to Lloyds secure site...");
    await page.goto(LLOYDS_SECURE_ROOT, { waitUntil: "domcontentloaded" });

    console.log(
      "Please log in with your credentials and complete any 2FA/memorable info."
    );
    console.log("Waiting for login to complete (up to 5 minutes)...");
    await page.waitForURL(LLOYDS_DASHBOARD_PATTERN, { timeout: 300_000 });

    console.log("Login successful! Fetching account details...");

    // Page is on the Lloyds domain — use in-page fetch to avoid
    // Playwright context.request Bun compatibility issues (oven-sh/bun#15679)
    const { ok, status, text } = await page.evaluate(
      async ({ url, headers }: { url: string; headers: Record<string, string> }) => {
        const res = await fetch(url, { headers });
        return { ok: res.ok, status: res.status, text: await res.text() };
      },
      {
        url: ACCOUNTS_URL,
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-GB,en;q=0.9",
          "Cache-Control": "no-cache",
          "IB-app-valid-end": "123",
        },
      }
    );

    if (!ok) {
      throw new Error(
        `Failed to fetch accounts (${status}). Please try logging in again.`
      );
    }

    const accounts = JSON.parse(text);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error(
        "No accounts found in API response. Cannot determine arrangementId."
      );
    }

    const { arrangementId } = accounts[0];
    if (!arrangementId) {
      throw new Error("arrangementId missing from account response.");
    }

    const storageState = await context.storageState();

    // Close page before context to flush the persistent profile to disk
    await page.close();
    await context.close();

    const session: LloydsCliSession = {
      arrangementId,
      cookies: storageState.cookies as LloydsCliSession["cookies"],
      origins: storageState.origins,
      createdAt: Date.now(),
    };

    saveSession(session);
    console.log(
      `Session saved to: ${SESSION_PATH}\nAccount arrangement ID: ${arrangementId}`
    );

    return session;
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}
